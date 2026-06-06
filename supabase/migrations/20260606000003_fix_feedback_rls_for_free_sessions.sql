-- ─────────────────────────────────────────────────────────────────────────────
-- Fix session_feedback INSERT policy for free sessions
-- ─────────────────────────────────────────────────────────────────────────────
-- Root cause: migration 20260604005219 overwrote the correct policy from
-- 20260603000002 with a broken variant that requires a live_viewers row to
-- exist (lv.user_id IS NOT NULL). However, live_viewers records are deleted by
-- the cleanup_viewers_on_stream_end trigger the moment is_live flips to false.
-- The feedback modal is shown *after* the session ends, so the live_viewers row
-- is always gone by the time the INSERT reaches the policy — meaning every free
-- session feedback attempt fails with 42501 (row-level security violation).
--
-- The can_submit_session_feedback() SECURITY DEFINER function (created in
-- 20260603000002) handles free events correctly: it returns true when
-- (is_free = true OR COALESCE(price,0) = 0) without touching live_viewers.
-- Reinstating the function-based policy fully fixes the regression.

DROP POLICY IF EXISTS "Users can submit their own feedback" ON public.session_feedback;

CREATE POLICY "Users can submit their own feedback"
ON public.session_feedback
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = audience_user_id
  AND public.can_submit_session_feedback(event_id)
);
