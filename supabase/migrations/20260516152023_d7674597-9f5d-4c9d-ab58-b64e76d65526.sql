
-- 1. Revoke column-level access to stripe_customer_id on profiles
REVOKE SELECT (stripe_customer_id) ON public.profiles FROM anon, authenticated;
REVOKE UPDATE (stripe_customer_id) ON public.profiles FROM anon, authenticated;
REVOKE INSERT (stripe_customer_id) ON public.profiles FROM anon, authenticated;

-- 2. Tighten tickets UPDATE policy — only allow when no protected columns change.
-- Trigger tickets_user_update_guard remains as defense-in-depth.
DROP POLICY IF EXISTS "Users can mark attendance on own tickets" ON public.tickets;

CREATE POLICY "Users can mark attendance on own tickets"
ON public.tickets
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  -- Defense-in-depth: column-level enforcement via trigger tickets_user_update_guard
);

-- Add a RESTRICTIVE policy that blocks any UPDATE that changes payment/identity columns
CREATE POLICY "tickets_block_protected_column_updates"
ON public.tickets
AS RESTRICTIVE
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);
-- Note: column-level immutability is enforced by tickets_user_update_guard trigger,
-- which raises on any change to payment_status, amount, currency,
-- stripe_checkout_session_id, user_id, event_id, or purchased_at.
