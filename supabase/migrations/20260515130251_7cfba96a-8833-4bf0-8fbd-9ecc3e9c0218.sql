CREATE OR REPLACE FUNCTION public.check_handle_available(target_handle text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE LOWER(handle) = LOWER(target_handle)
  );
$$;

REVOKE EXECUTE ON FUNCTION public.check_handle_available(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_handle_available(text) TO anon, authenticated;