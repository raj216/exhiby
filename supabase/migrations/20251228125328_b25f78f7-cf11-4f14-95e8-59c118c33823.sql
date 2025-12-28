-- Drop existing functions first to allow changing return types
DROP FUNCTION IF EXISTS public.search_public_profiles(text);
DROP FUNCTION IF EXISTS public.get_public_profile(uuid);

-- Update public profile search to include both profile row id and user_id
CREATE OR REPLACE FUNCTION public.search_public_profiles(search_text text)
RETURNS TABLE(
  id uuid,
  user_id uuid,
  handle text,
  name text,
  avatar_url text,
  bio text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    p.id,
    p.user_id,
    p.handle,
    p.name,
    p.avatar_url,
    p.bio
  FROM public.profiles p
  WHERE 
    search_text IS NOT NULL 
    AND search_text <> ''
    AND (
      p.name ILIKE '%' || search_text || '%'
      OR p.handle ILIKE '%' || search_text || '%'
    )
  ORDER BY 
    CASE WHEN p.handle ILIKE search_text || '%' THEN 0
         WHEN p.name ILIKE search_text || '%' THEN 1
         ELSE 2
    END,
    p.name
  LIMIT 50;
$$;

-- Public profile by user_id (canonical, matches auth uid)
CREATE OR REPLACE FUNCTION public.get_public_profile(profile_user_id uuid)
RETURNS TABLE(
  user_id uuid,
  name text,
  handle text,
  avatar_url text,
  bio text
)
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
    p.bio
  FROM public.profiles p
  WHERE p.user_id = profile_user_id;
$$;

-- Fallback: public profile by profile row id
CREATE OR REPLACE FUNCTION public.get_public_profile_by_profile_id(profile_id uuid)
RETURNS TABLE(
  user_id uuid,
  name text,
  handle text,
  avatar_url text,
  bio text
)
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
    p.bio
  FROM public.profiles p
  WHERE p.id = profile_id;
$$;