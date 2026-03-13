
-- Fix 1: Restrict tickets UPDATE policy to only allow updating attended_at
DROP POLICY IF EXISTS "Users can update their own tickets" ON public.tickets;

CREATE POLICY "Users can mark attendance on own tickets"
ON public.tickets FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
);

-- Create a function to restrict which columns users can update on tickets
CREATE OR REPLACE FUNCTION public.tickets_user_update_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Users can only update attended_at; all payment fields must remain unchanged
  IF NEW.payment_status IS DISTINCT FROM OLD.payment_status THEN
    RAISE EXCEPTION 'Cannot modify payment_status';
  END IF;
  IF NEW.amount IS DISTINCT FROM OLD.amount THEN
    RAISE EXCEPTION 'Cannot modify amount';
  END IF;
  IF NEW.currency IS DISTINCT FROM OLD.currency THEN
    RAISE EXCEPTION 'Cannot modify currency';
  END IF;
  IF NEW.stripe_checkout_session_id IS DISTINCT FROM OLD.stripe_checkout_session_id THEN
    RAISE EXCEPTION 'Cannot modify stripe_checkout_session_id';
  END IF;
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Cannot modify user_id';
  END IF;
  IF NEW.event_id IS DISTINCT FROM OLD.event_id THEN
    RAISE EXCEPTION 'Cannot modify event_id';
  END IF;
  IF NEW.purchased_at IS DISTINCT FROM OLD.purchased_at THEN
    RAISE EXCEPTION 'Cannot modify purchased_at';
  END IF;
  RETURN NEW;
END;
$$;

-- Only apply the guard when the caller is NOT service_role
DROP TRIGGER IF EXISTS tickets_user_update_guard ON public.tickets;
CREATE TRIGGER tickets_user_update_guard
BEFORE UPDATE ON public.tickets
FOR EACH ROW
WHEN (current_setting('request.jwt.claims', true)::jsonb->>'role' IS DISTINCT FROM 'service_role')
EXECUTE FUNCTION public.tickets_user_update_guard();

-- Fix 2: Create separate private table for Stripe connected account IDs
CREATE TABLE IF NOT EXISTS public.stripe_connect_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  stripe_connected_account_id text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.stripe_connect_accounts ENABLE ROW LEVEL SECURITY;

-- Only service_role can access this table (edge functions use service role)
CREATE POLICY "Service role full access"
ON public.stripe_connect_accounts FOR ALL
USING ((auth.jwt() ->> 'role'::text) = 'service_role'::text)
WITH CHECK ((auth.jwt() ->> 'role'::text) = 'service_role'::text);

-- Migrate existing data
INSERT INTO public.stripe_connect_accounts (user_id, stripe_connected_account_id)
SELECT user_id, stripe_connected_account_id
FROM public.profiles
WHERE stripe_connected_account_id IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;

-- Remove the column from profiles
ALTER TABLE public.profiles DROP COLUMN IF EXISTS stripe_connected_account_id;
