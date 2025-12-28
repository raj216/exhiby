-- Update get_public_profile to include cover_url and website
DROP FUNCTION IF EXISTS public.get_public_profile(uuid);
CREATE OR REPLACE FUNCTION public.get_public_profile(profile_user_id uuid)
RETURNS TABLE(user_id uuid, name text, handle text, avatar_url text, bio text, cover_url text, website text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    p.user_id,
    p.name,
    p.handle,
    p.avatar_url,
    p.bio,
    p.cover_url,
    p.website
  FROM public.profiles p
  WHERE p.user_id = profile_user_id;
$$;

-- Update get_public_profile_by_profile_id to include cover_url and website
DROP FUNCTION IF EXISTS public.get_public_profile_by_profile_id(uuid);
CREATE OR REPLACE FUNCTION public.get_public_profile_by_profile_id(profile_id uuid)
RETURNS TABLE(user_id uuid, name text, handle text, avatar_url text, bio text, cover_url text, website text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    p.user_id,
    p.name,
    p.handle,
    p.avatar_url,
    p.bio,
    p.cover_url,
    p.website
  FROM public.profiles p
  WHERE p.id = profile_id;
$$;