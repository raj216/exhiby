-- check_username_available: callable by anon (signup form, pre-auth)
-- Returns true = available, false = taken. Exposes NO profile data.
CREATE OR REPLACE FUNCTION public.check_username_available(p_username text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE lower(handle) = lower(trim(p_username))
  );
$$;

GRANT EXECUTE ON FUNCTION public.check_username_available(text) TO anon, authenticated;

-- check_username_available_for_update: callable by authenticated users only.
-- Returns true if the handle is unclaimed OR belongs to the calling user.
-- Used in PassportModal / Settings where a user edits their own handle.
CREATE OR REPLACE FUNCTION public.check_username_available_for_update(p_username text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE lower(handle) = lower(trim(p_username))
      AND user_id != auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public.check_username_available_for_update(text) TO authenticated;
