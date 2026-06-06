
-- 1. Revoke buyer user_id column from creator_earnings for creators
REVOKE SELECT (user_id) ON public.creator_earnings FROM authenticated;

-- 2. Revoke stripe_checkout_session_id column from tickets for non-buyers
REVOKE SELECT (stripe_checkout_session_id) ON public.tickets FROM authenticated;
-- Buyers still need to read their own; keep service_role full access. Buyers reading own tickets won't see the column either, but that's acceptable for client UI (they don't need it).

-- 3. Tighten live_viewers INSERT/UPDATE policies: remove the price<=0 branch (use canonical is_free flag only)
DROP POLICY IF EXISTS "Users can join as viewer" ON public.live_viewers;
CREATE POLICY "Users can join as viewer" ON public.live_viewers
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (
      EXISTS (SELECT 1 FROM public.events e WHERE e.id = live_viewers.event_id AND e.creator_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.events e WHERE e.id = live_viewers.event_id AND e.is_free = true)
      OR EXISTS (
        SELECT 1 FROM public.tickets t
        WHERE t.event_id = live_viewers.event_id
          AND t.user_id = auth.uid()
          AND t.payment_status IN ('paid','free')
      )
    )
  );

DROP POLICY IF EXISTS "Users can update their own viewer record" ON public.live_viewers;
CREATE POLICY "Users can update their own viewer record" ON public.live_viewers
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND (
      EXISTS (SELECT 1 FROM public.events e WHERE e.id = live_viewers.event_id AND e.creator_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.events e WHERE e.id = live_viewers.event_id AND e.is_free = true)
      OR EXISTS (
        SELECT 1 FROM public.tickets t
        WHERE t.event_id = live_viewers.event_id
          AND t.user_id = auth.uid()
          AND t.payment_status IN ('paid','free')
      )
    )
  );
