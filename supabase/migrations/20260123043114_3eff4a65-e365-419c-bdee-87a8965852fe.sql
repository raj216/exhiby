-- Remove overly permissive public SELECT on profiles
DROP POLICY IF EXISTS "Public can view basic profiles" ON public.profiles;

-- Ensure public-facing access happens only through vetted RPCs
-- (These SECURITY DEFINER functions return only safe, public fields.)
GRANT EXECUTE ON FUNCTION public.get_public_profile(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_profile_by_profile_id(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_all_public_profiles() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.search_public_profiles(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_creator_profiles(uuid[]) TO anon, authenticated;
