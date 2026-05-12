/**
 * useCreatorDeviceRole
 * ─────────────────────────────────────────────────────────────────────────────
 * Determines whether the current device is the PRIMARY (camera + controls)
 * device or a COMPANION (chat + audience management, no camera) device for a
 * live session.
 *
 * Source of truth: events.primary_device_id (DB column).
 *
 * Decision happens IMMEDIATELY on page load via an atomic claim:
 *
 *   UPDATE events SET primary_device_id = me
 *   WHERE id = eventId
 *     AND (primary_device_id IS NULL OR primary_device_id = me)
 *
 *   - If the row was updated (we wrote our id) → we hold primary
 *   - If 0 rows updated → someone else holds primary → we become companion
 *
 * The atomic claim runs BEFORE Daily.co joins, so the companion device never
 * tries to broadcast. We also subscribe to realtime updates on
 * primary_device_id so:
 *   • If the primary device ends the stream and clears the column, secondary
 *     devices stay companion (the stream is over).
 *   • If a secondary device somehow held a stale role, a fresh claim
 *     overrides it cleanly.
 *
 * Why this beats presence channels: the DB write is atomic — no race. Only
 * the device that actually wrote its id to the row holds primary, and that
 * decision is visible to every other device via either the post-write read
 * or postgres_changes realtime.
 */

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getDeviceId } from "@/lib/deviceId";

export type CreatorDeviceRole = "checking" | "primary" | "companion";

interface CreatorDeviceRoleResult {
  role: CreatorDeviceRole;
  /** Local browser deviceId (stable per browser via localStorage). */
  deviceId: string;
  /** Clear our claim — called when ending the stream. */
  releasePrimary: () => Promise<void>;
}

export function useCreatorDeviceRole(
  eventId: string | null,
  isCreator: boolean
): CreatorDeviceRoleResult {
  const deviceId = getDeviceId();
  const [role, setRole] = useState<CreatorDeviceRole>("checking");

  // ── Atomic claim + initial role decision ────────────────────────────────
  useEffect(() => {
    if (!eventId || !isCreator) {
      setRole("checking");
      return;
    }

    let cancelled = false;

    (async () => {
      console.log("[useCreatorDeviceRole] Attempting atomic claim", {
        eventId,
        deviceId,
      });

      const { data: claimed, error } = await supabase
        .from("events")
        .update({ primary_device_id: deviceId })
        .eq("id", eventId)
        .or(`primary_device_id.is.null,primary_device_id.eq.${deviceId}`)
        .select("primary_device_id");

      if (cancelled) return;

      if (error) {
        // Most common cause: the primary_device_id column doesn't exist yet
        // (migration hasn't been applied to this Supabase project). Detect
        // that specifically and emit a loud warning — otherwise the creator
        // sees both devices broadcasting and has no idea why.
        const looksLikeMissingColumn =
          (error.message || "").toLowerCase().includes("primary_device_id") ||
          error.code === "42703" || // postgres: undefined_column
          error.code === "PGRST204"; // postgrest: column not found

        if (looksLikeMissingColumn) {
          console.error(
            "[useCreatorDeviceRole] ⚠️ events.primary_device_id column is missing. " +
              "Apply the migration in supabase/migrations/*_add_primary_device_id_to_events.sql " +
              "to enable companion-device auto-detection. " +
              "Falling back to single-device mode for now.",
            error
          );
        } else {
          console.error(
            "[useCreatorDeviceRole] Claim failed — falling back to single-device mode.",
            error
          );
        }
        setRole("primary");
        return;
      }

      if (claimed && claimed.length > 0) {
        console.log("[useCreatorDeviceRole] ✓ Claimed primary slot");
        setRole("primary");
        return;
      }

      // 0 rows updated → someone else holds primary
      const { data: row } = await supabase
        .from("events")
        .select("primary_device_id")
        .eq("id", eventId)
        .maybeSingle();

      if (cancelled) return;

      const holder = row?.primary_device_id;
      if (holder && holder !== deviceId) {
        console.log("[useCreatorDeviceRole] → companion (held by", holder, ")");
        setRole("companion");
      } else {
        // Rare race: column became null between our two queries. Treat as
        // primary; the realtime subscription will correct if someone else
        // claims later.
        console.warn(
          "[useCreatorDeviceRole] Claim returned 0 rows but column is free, defaulting to primary"
        );
        setRole("primary");
      }
    })();

    // ── Realtime: react if another device claims/releases primary ─────────
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
          const holder = newRow.primary_device_id;
          if (!holder) {
            // Column cleared (stream ended). Don't change role here — the
            // stream-ended handling elsewhere navigates away.
            return;
          }
          setRole((prev) => {
            const next = holder === deviceId ? "primary" : "companion";
            if (next !== prev) {
              console.log(
                "[useCreatorDeviceRole] role change via realtime:",
                prev,
                "→",
                next
              );
            }
            return next;
          });
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [eventId, isCreator, deviceId]);

  // ── Release primary slot — called when ending the stream ────────────────
  const releasePrimary = useCallback(async () => {
    if (!eventId) return;
    const { error } = await supabase
      .from("events")
      .update({ primary_device_id: null })
      .eq("id", eventId)
      .eq("primary_device_id", deviceId);

    if (error) {
      console.error("[useCreatorDeviceRole] release failed:", error);
    }
  }, [eventId, deviceId]);

  return { role, deviceId, releasePrimary };
}
