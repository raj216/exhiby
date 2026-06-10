-- ─────────────────────────────────────────────────────────────────────────────
-- Abandoned-session reaper + scheduled-session reminder cron
-- ─────────────────────────────────────────────────────────────────────────────
-- Two problems this migration fixes:
--
--   (B) A live session could stay is_live=true FOREVER if the creator closed the
--       tab / crashed / lost power without pressing "End". Nothing ever set
--       is_live=false, so the studio kept showing as LIVE in feeds with a
--       hostless room. We add a host-liveness heartbeat and a reaper that ends
--       sessions the host has clearly abandoned.
--
--   (C) The scheduled-session notifier (check-starting-soon) was never scheduled
--       in the repo — the 15-min reminder, "starting now" push to saved-session
--       users, and the missed-session auto-end relied on a cron that did not
--       exist in source control. We schedule it here so it is reproducible and
--       auto-applies on merge.
--
-- pg_cron + pg_net are already enabled (migration 20260116050913).

-- ── 1. Host-liveness heartbeat column ────────────────────────────────────────
-- A solo-broadcasting creator (no audience yet) leaves NO live_viewers row, so
-- "no viewers" is NOT a safe abandonment signal — it would kill active solo
-- sessions. This column is the true "host is still here" signal: the creator's
-- client beats it every ~45s while connected to the room.
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS live_heartbeat_at timestamptz;

-- ── 2. Creator-only heartbeat RPC ────────────────────────────────────────────
-- Only the creator can beat, and only while the event is actually live. This
-- keeps the write off the client's RLS/column-grant surface and guarantees a
-- viewer can never forge a heartbeat.
CREATE OR REPLACE FUNCTION public.touch_live_heartbeat(p_event_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.events
  SET live_heartbeat_at = now()
  WHERE id = p_event_id
    AND creator_id = auth.uid()
    AND is_live = true
    AND live_ended_at IS NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.touch_live_heartbeat(uuid) TO authenticated;

-- ── 3. The reaper ────────────────────────────────────────────────────────────
-- Ends only sessions with POSITIVE evidence of abandonment, so it can never end
-- an active session:
--   • Arm 1 — the host heartbeat went stale (>3 min since last beat). At a 45s
--     beat interval that is 4 missed beats, well past any transient blip.
--   • Arm 2 — a legacy / pre-heartbeat session left live absurdly long (>12h).
--     12h is far beyond any real session, so no active session is at risk; this
--     just cleans up rows stranded before the heartbeat existed.
-- Setting is_live=false fires the existing cleanup_viewers_on_stream_end trigger
-- (deletes live_viewers) and we also clear primary_device_id so the creator can
-- cleanly re-claim the studio on a fresh start.
CREATE OR REPLACE FUNCTION public.end_abandoned_sessions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  WITH ended AS (
    UPDATE public.events e
    SET is_live = false,
        live_ended_at = now(),
        primary_device_id = NULL
    WHERE e.is_live = true
      AND e.live_ended_at IS NULL
      AND (
        (e.live_heartbeat_at IS NOT NULL
           AND e.live_heartbeat_at < now() - interval '3 minutes')
        OR
        (e.live_heartbeat_at IS NULL
           AND e.live_started_at IS NOT NULL
           AND e.live_started_at < now() - interval '12 hours')
      )
    RETURNING e.id
  )
  SELECT count(*) INTO v_count FROM ended;
  RETURN v_count;
END;
$$;

-- Only the cron job (runs as postgres) should call this. Keep it off the client.
REVOKE EXECUTE ON FUNCTION public.end_abandoned_sessions() FROM PUBLIC, anon, authenticated;

-- ── 4. Schedule the reaper every 2 minutes (idempotent) ──────────────────────
DO $$ BEGIN PERFORM cron.unschedule('end-abandoned-sessions'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule(
  'end-abandoned-sessions',
  '*/2 * * * *',
  $$ SELECT public.end_abandoned_sessions(); $$
);

-- ── 5. Schedule the scheduled-session notifier every minute (idempotent) ─────
-- check-starting-soon has verify_jwt=false (see supabase/config.toml), so it is
-- invoked anonymously — no JWT/service-role secret is embedded here. The URL is
-- the public Functions endpoint for this project.
DO $$ BEGIN PERFORM cron.unschedule('check-starting-soon'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule(
  'check-starting-soon',
  '* * * * *',
  $$
  SELECT net.http_post(
    url     := 'https://owvwwslbwbarvmjjtlkz.supabase.co/functions/v1/check-starting-soon',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body    := '{}'::jsonb
  );
  $$
);
