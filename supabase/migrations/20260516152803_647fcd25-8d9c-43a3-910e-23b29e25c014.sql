
-- 1) Hide stripe_checkout_session_id from client roles. Service role (edge functions) still reads it.
REVOKE SELECT (stripe_checkout_session_id) ON public.tickets FROM anon, authenticated;
REVOKE INSERT (stripe_checkout_session_id) ON public.tickets FROM anon, authenticated;
REVOKE UPDATE (stripe_checkout_session_id) ON public.tickets FROM anon, authenticated;

-- 2) Tighten live_viewers INSERT: must be creator, free event, or hold a confirmed ticket.
DROP POLICY IF EXISTS "Users can join as viewer" ON public.live_viewers;

CREATE POLICY "Users can join as viewer"
ON public.live_viewers
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND (
    -- Creator of the event always allowed
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = live_viewers.event_id
        AND e.creator_id = auth.uid()
    )
    -- Free event: any authenticated user allowed
    OR EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = live_viewers.event_id
        AND (e.is_free = true OR COALESCE(e.price, 0) <= 0)
    )
    -- Paid event: must hold a confirmed ticket
    OR EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.event_id = live_viewers.event_id
        AND t.user_id = auth.uid()
        AND t.payment_status IN ('paid', 'free')
    )
  )
);
