
-- Add Stripe Connect account ID to profiles
ALTER TABLE public.profiles
ADD COLUMN stripe_connected_account_id text DEFAULT NULL;

-- Create payouts tracking table
CREATE TABLE public.creator_payouts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  creator_id uuid NOT NULL,
  stripe_payout_id text,
  stripe_transfer_id text,
  amount integer NOT NULL DEFAULT 0, -- in cents
  currency text NOT NULL DEFAULT 'usd',
  status text NOT NULL DEFAULT 'pending', -- pending, paid, failed, canceled
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_creator_payouts_creator ON public.creator_payouts(creator_id);

ALTER TABLE public.creator_payouts ENABLE ROW LEVEL SECURITY;

-- Creators can view their own payouts
CREATE POLICY "Creators can view their own payouts"
  ON public.creator_payouts
  FOR SELECT
  USING (auth.uid() = creator_id);

-- Service role full access
CREATE POLICY "Service role full access on creator_payouts"
  ON public.creator_payouts
  FOR ALL
  USING ((auth.jwt() ->> 'role'::text) = 'service_role'::text)
  WITH CHECK ((auth.jwt() ->> 'role'::text) = 'service_role'::text);

-- Trigger for updated_at
CREATE TRIGGER update_creator_payouts_updated_at
  BEFORE UPDATE ON public.creator_payouts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
