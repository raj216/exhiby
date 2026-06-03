
-- Allow feedback from users who attended free events (no ticket required for free sessions)
DROP POLICY IF EXISTS "Users can submit their own feedback" ON public.session_feedback;

CREATE POLICY "Users can submit their own feedback"
ON public.session_feedback
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = audience_user_id
  AND (
    -- Has a confirmed ticket (paid events)
    EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.event_id = session_feedback.event_id
        AND t.user_id = auth.uid()
        AND t.payment_status IN ('paid', 'free')
    )
    OR
    -- Free event — no ticket needed
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = session_feedback.event_id
        AND (e.is_free = true OR COALESCE(e.price, 0) = 0)
    )
  )
);
