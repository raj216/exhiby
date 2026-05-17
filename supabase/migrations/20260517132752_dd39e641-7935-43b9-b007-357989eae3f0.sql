-- 1. Profile self-verify guard
CREATE OR REPLACE FUNCTION public.prevent_profile_trust_self_upgrade()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    IF NEW.is_verified IS DISTINCT FROM OLD.is_verified THEN
      RAISE EXCEPTION 'Cannot modify is_verified';
    END IF;
    IF NEW.verified_at IS DISTINCT FROM OLD.verified_at THEN
      RAISE EXCEPTION 'Cannot modify verified_at';
    END IF;
    IF NEW.is_founding_member IS DISTINCT FROM OLD.is_founding_member THEN
      RAISE EXCEPTION 'Cannot modify is_founding_member';
    END IF;
    IF NEW.founding_number IS DISTINCT FROM OLD.founding_number THEN
      RAISE EXCEPTION 'Cannot modify founding_number';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_prevent_trust_self_upgrade ON public.profiles;
CREATE TRIGGER profiles_prevent_trust_self_upgrade
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_profile_trust_self_upgrade();

-- 2. Reconfirm column-level REVOKE on creator_earnings sensitive identifiers
REVOKE SELECT (user_id, stripe_payment_intent_id, stripe_checkout_session_id, stripe_event_id)
  ON public.creator_earnings FROM anon, authenticated;