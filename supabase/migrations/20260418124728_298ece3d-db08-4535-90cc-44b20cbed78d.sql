-- Add explicit restrictive deny-all policy on stripe_webhook_events.
-- This table stores raw Stripe webhook payloads (sensitive financial data)
-- and must only be accessed server-side via the service role key.
-- A RESTRICTIVE policy with USING (false) ensures no anon/authenticated
-- user can ever SELECT/INSERT/UPDATE/DELETE rows via the API, regardless
-- of any future permissive policy that might be added by mistake.

CREATE POLICY "Deny all client access to stripe webhook events"
ON public.stripe_webhook_events
AS RESTRICTIVE
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);