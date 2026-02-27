
-- Table to log all incoming Stripe webhook events for debugging & idempotency
CREATE TABLE public.stripe_webhook_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id text NOT NULL,
  event_type text NOT NULL,
  status text NOT NULL DEFAULT 'received',
  payload_json jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Unique constraint on Stripe event ID for idempotency
CREATE UNIQUE INDEX idx_stripe_webhook_events_event_id ON public.stripe_webhook_events (event_id);

-- Enable RLS
ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;

-- Only service role can read/write (no client access needed)
CREATE POLICY "Service role full access"
  ON public.stripe_webhook_events
  FOR ALL
  USING ((auth.jwt() ->> 'role'::text) = 'service_role'::text)
  WITH CHECK ((auth.jwt() ->> 'role'::text) = 'service_role'::text);
