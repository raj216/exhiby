-- ─────────────────────────────────────────────────────────────────────────────
-- Creator approval trigger
--
-- When an admin sets creator_applications.status = 'approved', this trigger
-- automatically:
--   1. Sets profiles.is_verified = true  (lights up the gold badge everywhere)
--   2. Sets profiles.verified_at = now() (timestamps the approval)
--   3. Inserts a row into user_roles for role = 'creator' (unlocks Studio mode)
--
-- On rejection (status = 'rejected'), it ensures the profile is NOT marked
-- verified and does NOT grant the creator role — safe for resubmissions.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_creator_application_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- ── Approval path ────────────────────────────────────────────────────────
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN

    -- Mark the profile as verified (powers the gold BadgeCheck across the app)
    UPDATE public.profiles
    SET
      is_verified = true,
      verified_at = now()
    WHERE user_id = NEW.user_id;

    -- Grant creator role so the user can enter Studio mode
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.user_id, 'creator')
    ON CONFLICT (user_id, role) DO NOTHING;

    -- Stamp the review timestamp on the application itself
    NEW.reviewed_at = now();

  -- ── Rejection path ───────────────────────────────────────────────────────
  ELSIF NEW.status = 'rejected' AND (OLD.status IS DISTINCT FROM 'rejected') THEN

    -- Stamp review timestamp; do NOT touch profiles or user_roles
    NEW.reviewed_at = now();

  END IF;

  RETURN NEW;
END;
$$;

-- Fire BEFORE UPDATE so we can mutate NEW.reviewed_at in one round-trip
DROP TRIGGER IF EXISTS on_creator_application_status_change ON public.creator_applications;
CREATE TRIGGER on_creator_application_status_change
  BEFORE UPDATE OF status ON public.creator_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_creator_application_status_change();
