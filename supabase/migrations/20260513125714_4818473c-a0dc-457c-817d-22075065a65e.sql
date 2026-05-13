
REVOKE EXECUTE ON FUNCTION public.get_public_profile(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_public_profile_by_profile_id(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_public_profile(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_profile_by_profile_id(uuid) TO authenticated;
