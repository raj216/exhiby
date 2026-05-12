/**
 * useCreatorDeviceRole
 * ─────────────────────────────────────────────────────────────────────────────
 * Determines whether the current device is the PRIMARY (camera + controls)
 * device or a COMPANION (chat + audience management, no camera) device for a
 * live session.
 *
 * Rules:
 *   • If the URL contains ?companion=1 (opened via QR code from the host
 *     device) → "companion". This is the explicit, intentional path.
 *   • If the user is the creator and no companion flag is set → "primary".
 *     The creator opening the live URL directly always runs the full live room.
 *   • "checking" is only returned briefly before the event finishes loading
 *     (when isCreator is still false and forceCompanion is false).
 *
 * Why no presence-based detection:
 *   Presence timestamps have inherent race conditions — if another browser tab
 *   or the Lovable preview loads first it claims the earliest joinedAt and
 *   incorrectly becomes "primary", leaving the phone with the camera stuck in
 *   companion mode. The QR code already carries ?companion=1, so we rely on
 *   that explicit signal rather than a racy timestamp comparison.
 */

export type CreatorDeviceRole = "checking" | "primary" | "companion";

export function useCreatorDeviceRole(
  eventId: string | null,
  isCreator: boolean,
  forceCompanion = false
): CreatorDeviceRole {
  // Explicit companion flag from the QR-code URL
  if (forceCompanion) return "companion";

  // Creator opening the live room directly → always the primary device
  if (isCreator && eventId) return "primary";

  // Event hasn't loaded yet (isCreator is based on event.creator_id)
  return "checking";
}
