
-- 1) Attach messages immutability triggers
DROP TRIGGER IF EXISTS protect_message_columns ON public.messages;
CREATE TRIGGER protect_message_columns
  BEFORE UPDATE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.protect_message_columns();

DROP TRIGGER IF EXISTS messages_update_column_guard ON public.messages;
CREATE TRIGGER messages_update_column_guard
  BEFORE UPDATE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.messages_update_column_guard();

-- 2) Live chat display name spoof prevention
CREATE OR REPLACE FUNCTION public.live_messages_force_display_name()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
BEGIN
  SELECT name INTO v_name FROM public.profiles WHERE user_id = NEW.user_id;
  NEW.display_name := COALESCE(v_name, 'Guest');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS live_messages_force_display_name ON public.live_messages;
CREATE TRIGGER live_messages_force_display_name
  BEFORE INSERT ON public.live_messages
  FOR EACH ROW EXECUTE FUNCTION public.live_messages_force_display_name();

-- 3) session_feedback: require confirmed ticket
DROP POLICY IF EXISTS "Users can submit their own feedback" ON public.session_feedback;
CREATE POLICY "Users can submit their own feedback"
ON public.session_feedback
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = audience_user_id
  AND EXISTS (
    SELECT 1 FROM public.tickets t
    WHERE t.event_id = session_feedback.event_id
      AND t.user_id = auth.uid()
      AND t.payment_status IN ('paid','free')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS session_feedback_unique_per_user_event
  ON public.session_feedback (audience_user_id, event_id);

-- 4) creator_earnings: revoke sensitive columns from clients
REVOKE SELECT (user_id, ticket_id, stripe_checkout_session_id, stripe_payment_intent_id, stripe_event_id)
  ON public.creator_earnings FROM anon, authenticated;

-- 5) Campaign email rate limit table
CREATE TABLE IF NOT EXISTS public.campaign_email_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL,
  recipient_count integer NOT NULL DEFAULT 0,
  segment text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.campaign_email_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Creators view own campaign log"
ON public.campaign_email_log
FOR SELECT
TO authenticated
USING (auth.uid() = creator_id);

CREATE POLICY "Deny client INSERT on campaign_email_log"
ON public.campaign_email_log
AS RESTRICTIVE
FOR INSERT
TO anon, authenticated
WITH CHECK (false);

CREATE POLICY "Deny client UPDATE on campaign_email_log"
ON public.campaign_email_log
AS RESTRICTIVE
FOR UPDATE
TO anon, authenticated
USING (false) WITH CHECK (false);

CREATE POLICY "Deny client DELETE on campaign_email_log"
ON public.campaign_email_log
AS RESTRICTIVE
FOR DELETE
TO anon, authenticated
USING (false);

CREATE INDEX IF NOT EXISTS campaign_email_log_creator_recent
  ON public.campaign_email_log (creator_id, created_at DESC);
