/**
 * useCreatorDeviceRole
 * ─────────────────────────────────────────────────────────────────────────────
 * Determines whether the current device is the PRIMARY (camera + controls)
 * device or a COMPANION (chat + audience management, no camera) device for a
 * live session.
 *
 * Source of truth: events.primary_device_id (DB column).
 *
 * Flow:
 *   • When a creator device successfully joins Daily.co as the broadcaster, it
 *     calls claimPrimary() which writes its stable browser deviceId to
 *     events.primary_device_id. This is the authoritative claim.
 *   • Every creator device subscribes to changes on this column. As soon as
 *     primary_device_id != null, each device compares it to its own deviceId:
 *       - match  → role = "primary"  → show full live room with camera
 *       - differ → role = "companion" → show CompanionModeView
 *   • If primary_device_id is null (no one has claimed yet), the device is
 *     considered eligible for primary — it will claim once Daily.co joins.
 *   • releasePrimary() clears the column when the stream ends.
 *
 * Why DB instead of presence: presence timestamps have a race condition where
 * a passive tab (e.g. Lovable preview) joining the channel before the actual
 * broadcaster steals the "primary" role. Using a DB column that is only
 * written by the device that actually started broadcasting eliminates this.
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getDeviceId } from "@/lib/deviceId";

export type CreatorDeviceRole = "checking" | "primary" | "companion";

interface CreatorDeviceRoleResult {
  role: CreatorDeviceRole;
  /** The local device's stable id (same value every time on this browser). */
  deviceId: string;
  /** Write our deviceId to events.primary_device_id. Safe to call repeatedly. */
  claimPrimary: () => Promise<void>;
  /** Clear events.primary_device_id when the stream ends. */
  releasePrimary: () => Promise<void>;
}

export function useCreatorDeviceRole(
  eventId: string | null,
  isCreator: boolean
): CreatorDeviceRoleResult {
  const deviceId = getDeviceId();
  const [role, setRole] = useState<CreatorDeviceRole>("checking");
  const claimedRef = useRef(false);

  // Apply a primary_device_id value to local role state.
  const applyPrimaryId = useCallback(
    (primaryId: string | null) => {
      if (!primaryId) {
        // No one has claimed yet — we are eligible to be primary. Stay in
        // "checking" until either we claim (after Daily.co join) or another
        // device claims it first. We can't render the camera UI yet but we
        // also shouldn't render companion. Defaulting to "primary" here lets
        // the creator's live UI render normally; if a different device then
        // claims it, this device will switch to "companion" via the realtime
        // subscription below.
        setRole("primary");
        return;
      }
      setRole(primaryId === deviceId ? "primary" : "companion");
    },
    [deviceId]
  );

  // Initial fetch + realtime subscription on events.primary_device_id
  useEffect(() => {
    if (!eventId || !isCreator) {
      // Not enough info yet, or this user isn't the creator.
      setRole("checking");
      return;
    }

    let cancelled = false;

    // 1. Initial read
    (async () => {
      const { data, error } = await supabase
        .from("events")
        .select("primary_device_id")
        .eq("id", eventId)
        .single();

      if (cancelled) return;
      if (error) {
        console.error("[useCreatorDeviceRole] initial fetch failed:", error);
        // Fail open as primary so the creator isn't locked out of their own
        // live room by a transient DB error.
        setRole("primary");
        return;
      }

      applyPrimaryId(data?.primary_device_id ?? null);
    })();

    // 2. Realtime subscription: react when another device claims/releases
    const channel = supabase
      .channel(`event-primary-${eventId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "events",
          filter: `id=eq.${eventId}`,
        },
        (payload) => {
          const newRow = payload.new as { primary_device_id: string | null };
          applyPrimaryId(newRow.primary_device_id ?? null);
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [eventId, isCreator, applyPrimaryId]);

  // Claim primary by writing our deviceId. Safe to call multiple times — the
  // claimedRef guard prevents redundant writes.
  const claimPrimary = useCallback(async () => {
    if (!eventId) return;
    if (claimedRef.current) return;
    claimedRef.current = true;

    const { error } = await supabase
      .from("events")
      .update({ primary_device_id: deviceId })
      .eq("id", eventId)
      // Only claim if no one else holds it, OR we already hold it (idempotent
      // refresh). Prevents a late-joining tab from stealing primary mid-stream.
      .or(`primary_device_id.is.null,primary_device_id.eq.${deviceId}`);

    if (error) {
      console.error("[useCreatorDeviceRole] claim failed:", error);
      claimedRef.current = false; // allow retry
    }
  }, [eventId, deviceId]);

  // Release primary slot — called when ending the stream.
  const releasePrimary = useCallback(async () => {
    if (!eventId) return;
    claimedRef.current = false;
    const { error } = await supabase
      .from("events")
      .update({ primary_device_id: null })
      .eq("id", eventId)
      .eq("primary_device_id", deviceId); // only clear our own claim

    if (error) {
      console.error("[useCreatorDeviceRole] release failed:", error);
    }
  }, [eventId, deviceId]);

  return { role, deviceId, claimPrimary, releasePrimary };
}
