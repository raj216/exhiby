
-- Add Stripe payment tracking columns to tickets table
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS stripe_checkout_session_id text,
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS currency text DEFAULT 'usd';

-- Index for webhook lookups by checkout session ID
CREATE INDEX IF NOT EXISTS idx_tickets_stripe_session 
  ON public.tickets (stripe_checkout_session_id) 
  WHERE stripe_checkout_session_id IS NOT NULL;

-- Index for payment status queries
CREATE INDEX IF NOT EXISTS idx_tickets_payment_status 
  ON public.tickets (payment_status);
