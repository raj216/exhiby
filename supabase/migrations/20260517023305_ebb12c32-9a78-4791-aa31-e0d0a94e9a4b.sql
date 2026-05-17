
-- 1. Revoke column-level SELECT on profiles.stripe_customer_id from clients
REVOKE SELECT (stripe_customer_id) ON public.profiles FROM anon, authenticated;

-- 2. Lock down messages UPDATE columns via trigger
CREATE OR REPLACE FUNCTION public.messages_update_column_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Immutable identity columns (already enforced by protect_message_columns, kept here defensively)
  IF NEW.conversation_id IS DISTINCT FROM OLD.conversation_id THEN
    RAISE EXCEPTION 'Cannot modify conversation_id';
  END IF;
  IF NEW.sender_id IS DISTINCT FROM OLD.sender_id THEN
    RAISE EXCEPTION 'Cannot modify sender_id';
  END IF;
  IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Cannot modify created_at';
  END IF;

  -- Sender: may only change content (NOT read_at)
  IF auth.uid() = OLD.sender_id THEN
    IF NEW.read_at IS DISTINCT FROM OLD.read_at THEN
      RAISE EXCEPTION 'Senders cannot modify read_at';
    END IF;
  ELSE
    -- Recipient/participant: may only change read_at (NOT content)
    IF NEW.content IS DISTINCT FROM OLD.content THEN
      RAISE EXCEPTION 'Only the sender can modify message content';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS messages_update_column_guard_trigger ON public.messages;
CREATE TRIGGER messages_update_column_guard_trigger
BEFORE UPDATE ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.messages_update_column_guard();
