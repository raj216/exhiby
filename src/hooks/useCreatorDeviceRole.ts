/**
 * useCreatorDeviceRole
 * ─────────────────────────────────────────────────────────────────────────────
 * Determines whether the current device is the PRIMARY (camera + controls)
 * device or a COMPANION (chat + audience management, no camera) device for a
 * live session.
 *
 * How it works:
 *   Each device that opens a live session as the creator joins a Supabase
 *   Realtime Presence channel named `creator-primary-{eventId}` and tracks:
 *     { deviceId: string, joinedAt: number }
 *
 *   After subscribing and announcing presence, we wait 1.2 s for the server to
 *   sync all currently-connected devices. Then:
 *   • If we are the ONLY device (or the one with the earliest `joinedAt`) →
 *     "primary"  → show the normal live room with camera
 *   • If another device joined earlier → "companion"  → show the companion
 *     management view (chat, hand-raises, materials — no camera)
 *
 * forceCompanion:
 *   When the URL contains ?companion=1 (e.g. from the QR code) we skip
 *   presence detection entirely and immediately return "companion".
 *
 * The `deviceId` is stable per-browser (localStorage) so refreshing the page
 * on the primary device keeps it as primary.
 */

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getDeviceId } from "@/lib/deviceId";

export type CreatorDeviceRole = "checking" | "primary" | "companion";

type PresenceEntry = { deviceId: string; joinedAt: number };

export function useCreatorDeviceRole(
  eventId: string | null,
  isCreator: boolean,
  forceCompanion = false
): CreatorDeviceRole {
  const [role, setRole] = useState<CreatorDeviceRole>(
    forceCompanion ? "companion" : "checking"
  );

  useEffect(() => {
    // Forced companion (came from QR code URL ?companion=1)
    if (forceCompanion) {
      setRole("companion");
      return;
    }

    // Not a creator, or session not loaded yet — nothing to do
    if (!eventId || !isCreator) return;

    const deviceId = getDeviceId();
    const joinedAt = Date.now();
    let decisionMade = false;
    let decisionTimer: ReturnType<typeof setTimeout> | null = null;

    const channelName = `creator-primary-${eventId}`;
    const channel = supabase.channel(channelName, {
      config: { presence: { key: deviceId } },
    });

    function resolveRole() {
      if (decisionMade) return;
      decisionMade = true;
      if (decisionTimer) {
        clearTimeout(decisionTimer);
        decisionTimer = null;
      }

      const state = channel.presenceState<PresenceEntry>();
      // presenceState returns { [key: string]: PresenceEntry[] }
      const allEntries: PresenceEntry[] = Object.values(state).flat() as PresenceEntry[];

      if (allEntries.length === 0) {
        // No one is tracked yet (can happen if our own track hasn't synced back)
        setRole("primary");
        return;
      }

      // The device with the earliest joinedAt timestamp is the primary
      const earliest = allEntries.reduce((min, e) =>
        e.joinedAt < min.joinedAt ? e : min
      );

      setRole(earliest.deviceId === deviceId ? "primary" : "companion");
    }

    channel
      // sync fires with current presence state — catches the case where
      // another device is already in the channel when we subscribe
      .on("presence", { event: "sync" }, resolveRole)
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          // Announce ourselves
          await channel.track({ deviceId, joinedAt });
          // Give 1.2 s for the server to sync all currently-connected devices.
          // If sync fires first we'll resolve earlier.
          decisionTimer = setTimeout(resolveRole, 1200);
        }
      });

    return () => {
      if (decisionTimer) clearTimeout(decisionTimer);
      supabase.removeChannel(channel);
    };
  }, [eventId, isCreator, forceCompanion]);

  return role;
}
