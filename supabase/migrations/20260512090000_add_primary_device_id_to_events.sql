-- Track which device is currently the primary (broadcasting) device for a live event.
--
-- Behaviour:
--   • The first device to successfully join Daily.co as the creator writes its
--     stable browser deviceId here.
--   • Any other device the same creator opens reads this column. If it does not
--     match the local deviceId, that device renders the companion view instead
--     of the camera-based live room.
--   • Cleared when the stream ends (set back to NULL).
--
-- This is the authoritative source of truth for primary/companion role
-- assignment. We previously used Supabase Realtime Presence timestamps for
-- this, but that approach had race conditions (e.g. a preview tab joining the
-- presence channel before the phone actually started broadcasting would steal
-- the "primary" role). Using a column on the events table avoids the race
-- entirely — only the device that successfully starts the Daily.co broadcast
-- claims the slot.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS primary_device_id text;

COMMENT ON COLUMN public.events.primary_device_id IS
  'Stable browser deviceId of the device currently broadcasting this live session. NULL when not live or before broadcast starts. Used to auto-detect primary vs companion devices for the creator.';
