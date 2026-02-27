
-- Table to store Stripe-confirmed payment records for creator earnings
-- Each row = one successful payment attributed to a creator
CREATE TABLE public.creator_earnings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  creator_id uuid NOT NULL,
  event_id uuid NOT NULL REFERENCES public.events(id),
  ticket_id uuid REFERENCES public.tickets(id),
  user_id uuid NOT NULL, -- buyer
  stripe_payment_intent_id text,
  stripe_checkout_session_id text,
  amount_gross integer NOT NULL DEFAULT 0, -- in cents
  platform_fee integer NOT NULL DEFAULT 0, -- in cents
  amount_net integer NOT NULL DEFAULT 0, -- in cents
  currency text NOT NULL DEFAULT 'usd',
  status text NOT NULL DEFAULT 'succeeded',
  stripe_event_id text UNIQUE, -- idempotency key
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Indexes for fast lookups
CREATE INDEX idx_creator_earnings_creator ON public.creator_earnings(creator_id);
CREATE INDEX idx_creator_earnings_created ON public.creator_earnings(created_at);
CREATE INDEX idx_creator_earnings_stripe_event ON public.creator_earnings(stripe_event_id);

-- Enable RLS
ALTER TABLE public.creator_earnings ENABLE ROW LEVEL SECURITY;

-- Creators can view their own earnings
CREATE POLICY "Creators can view their own earnings"
  ON public.creator_earnings
  FOR SELECT
  USING (auth.uid() = creator_id);

-- Service role full access (for webhook inserts)
CREATE POLICY "Service role full access on creator_earnings"
  ON public.creator_earnings
  FOR ALL
  USING ((auth.jwt() ->> 'role'::text) = 'service_role'::text)
  WITH CHECK ((auth.jwt() ->> 'role'::text) = 'service_role'::text);
