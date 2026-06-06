-- Allow audience to submit feedback when they have a confirmed ticket,
-- OR when the session is free and they actually attended (live_viewers row).
DROP POLICY IF EXISTS "Users can submit their own feedback" ON public.session_feedback;

CREATE POLICY "Users can submit their own feedback"
ON public.session_feedback
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = audience_user_id
  AND (
    EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.event_id = session_feedback.event_id
        AND t.user_id  = auth.uid()
        AND t.payment_status IN ('paid','free')
    )
    OR EXISTS (
      SELECT 1
      FROM public.events e
      LEFT JOIN public.live_viewers lv
        ON lv.event_id = e.id AND lv.user_id = auth.uid()
      WHERE e.id = session_feedback.event_id
        AND e.is_free = true
        AND lv.user_id IS NOT NULL
    )
  )
);