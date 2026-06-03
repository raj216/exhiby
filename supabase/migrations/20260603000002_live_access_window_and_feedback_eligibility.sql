-- ─────────────────────────────────────────────────────────────────────────────
-- Live-room access reliability + robust feedback eligibility
-- ─────────────────────────────────────────────────────────────────────────────
-- Root cause of "Failed to send message" / "can't see creator messages" /
-- "can't see materials" for the mobile audience: every viewer-side gate keyed on
-- live_viewers.last_seen > now() - 30s. On mobile, background-timer throttling and
-- network lag push last_seen past 30s, simultaneously blocking chat send, chat
-- read, and materials read. Widen the ACCESS gates to 2 minutes (the live-count
-- functions stay at 30s so "viewers online" remains accurate).
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) live_messages SELECT — active participants (creator OR recent viewer)
DROP POLICY IF EXISTS "Active participants can read messages" ON public.live_messages;
CREATE POLICY "Active participants can read messages"
ON public.live_messages FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.events
    WHERE events.id = live_messages.event_id
    AND events.creator_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM public.live_viewers
    WHERE live_viewers.event_id = live_messages.event_id
    AND live_viewers.user_id = auth.uid()
    AND live_viewers.last_seen > (now() - interval '2 minutes')
  )
);

-- 2) live_messages INSERT — keep role-spoof enforcement, widen viewer window
DROP POLICY IF EXISTS "Users can insert their own messages" ON public.live_messages;
CREATE POLICY "Users can insert their own messages"
ON public.live_messages
FOR INSERT
TO authenticated
WITH CHECK (
  (auth.uid() = user_id)
  AND (
    (
      role = 'creator'
      AND EXISTS (
        SELECT 1 FROM events
        WHERE events.id = live_messages.event_id
        AND events.creator_id = auth.uid()
      )
    )
    OR
    (
      role = 'viewer'
      AND EXISTS (
        SELECT 1 FROM live_viewers
        WHERE live_viewers.event_id = live_messages.event_id
        AND live_viewers.user_id = auth.uid()
        AND live_viewers.last_seen > (now() - interval '2 minutes')
      )
    )
  )
);

-- 3) live_materials SELECT — creator OR active viewer during accessible window
DROP POLICY IF EXISTS "Materials visible for accessible events" ON public.live_materials;
CREATE POLICY "Materials visible for accessible events"
ON public.live_materials
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM events e
    WHERE e.id = live_materials.event_id
    AND e.creator_id = auth.uid()
  )
  OR
  (
    EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = live_materials.event_id
      AND (
        (e.is_live = true AND e.live_ended_at IS NULL)
        OR e.scheduled_at > now()
        OR (e.live_ended_at IS NOT NULL AND e.live_ended_at > (now() - interval '30 minutes'))
      )
    )
    AND EXISTS (
      SELECT 1 FROM live_viewers lv
      WHERE lv.event_id = live_materials.event_id
      AND lv.user_id = auth.uid()
      AND lv.last_seen > (now() - interval '2 minutes')
    )
  )
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4) Robust session_feedback eligibility
-- ─────────────────────────────────────────────────────────────────────────────
-- The previous policy depended on the events 30-min grace window AND on the
-- submitter still being able to SELECT the event under RLS. A SECURITY DEFINER
-- helper makes eligibility reliable: the user may submit feedback for an event
-- they paid for (ticket), a free event, or any event they actually attended
-- (a live_viewers row exists — no time window required).
CREATE OR REPLACE FUNCTION public.can_submit_session_feedback(p_event_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN false;
  END IF;

  -- Confirmed ticket holder (paid or free ticket)
  IF EXISTS (
    SELECT 1 FROM public.tickets t
    WHERE t.event_id = p_event_id
      AND t.user_id = v_uid
      AND t.payment_status IN ('paid', 'free')
  ) THEN
    RETURN true;
  END IF;

  -- Free / zero-price event (no ticket is created for these)
  IF EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = p_event_id
      AND (e.is_free = true OR COALESCE(e.price, 0) = 0)
  ) THEN
    RETURN true;
  END IF;

  -- Attended the session at any point (viewer record exists)
  IF EXISTS (
    SELECT 1 FROM public.live_viewers lv
    WHERE lv.event_id = p_event_id
      AND lv.user_id = v_uid
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.can_submit_session_feedback(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_submit_session_feedback(uuid) TO authenticated;

DROP POLICY IF EXISTS "Users can submit their own feedback" ON public.session_feedback;
CREATE POLICY "Users can submit their own feedback"
ON public.session_feedback
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = audience_user_id
  AND public.can_submit_session_feedback(event_id)
);
