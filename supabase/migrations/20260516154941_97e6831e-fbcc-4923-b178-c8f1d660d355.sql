
-- Re-validate ticket on UPDATE so refunded/invalidated users can't keep last_seen fresh
DROP POLICY IF EXISTS "Users can update their own viewer record" ON public.live_viewers;

CREATE POLICY "Users can update their own viewer record"
ON public.live_viewers
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = live_viewers.event_id AND e.creator_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = live_viewers.event_id
        AND (e.is_free = true OR COALESCE(e.price, 0) <= 0)
    )
    OR EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.event_id = live_viewers.event_id
        AND t.user_id = auth.uid()
        AND t.payment_status IN ('paid', 'free')
    )
  )
);
