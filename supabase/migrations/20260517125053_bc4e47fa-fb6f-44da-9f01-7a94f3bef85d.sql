-- 1. Column-level REVOKE on creator_earnings stripe identifier columns
REVOKE SELECT (stripe_payment_intent_id, stripe_checkout_session_id, stripe_event_id)
  ON public.creator_earnings FROM anon, authenticated;

-- 2. Harden messages UPDATE at the privilege layer (defense in depth on top of trigger).
-- Revoke blanket UPDATE, then re-grant only on the two mutable columns.
REVOKE UPDATE ON public.messages FROM anon, authenticated;
GRANT UPDATE (content, read_at) ON public.messages TO authenticated;

-- 3. Reinforce live_viewers UPDATE WITH CHECK to explicitly exclude any non-confirmed ticket status
--    (refunded / pending / failed). The existing check restricts to ('paid','free'), but we recreate it
--    to make intent explicit and exclude any future statuses by default.
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
        AND t.payment_status IN ('paid','free')
        AND t.payment_status NOT IN ('refunded','pending','failed','disputed','canceled')
    )
  )
);

-- Same hardening for INSERT (parallel logic, explicit exclude list)
DROP POLICY IF EXISTS "Users can join as viewer" ON public.live_viewers;
CREATE POLICY "Users can join as viewer"
ON public.live_viewers
FOR INSERT
TO authenticated
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
        AND t.payment_status IN ('paid','free')
        AND t.payment_status NOT IN ('refunded','pending','failed','disputed','canceled')
    )
  )
);