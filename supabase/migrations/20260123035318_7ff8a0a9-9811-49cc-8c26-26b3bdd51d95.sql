-- Add single source of truth for verification
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_verified boolean NOT NULL DEFAULT false;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS verified_at timestamp with time zone;

-- Drop/recreate RPCs where return types must change
DROP FUNCTION IF EXISTS public.get_all_public_profiles();
DROP FUNCTION IF EXISTS public.get_public_profile(uuid);
DROP FUNCTION IF EXISTS public.get_public_profile_by_profile_id(uuid);
DROP FUNCTION IF EXISTS public.search_public_profiles(text);
DROP FUNCTION IF EXISTS public.get_creator_profiles(uuid[]);
DROP FUNCTION IF EXISTS public.get_following_list(uuid);
DROP FUNCTION IF EXISTS public.get_followers_list(uuid);

-- Recreate with is_verified included
CREATE FUNCTION public.get_all_public_profiles()
 RETURNS TABLE(
  id uuid,
  user_id uuid,
  name text,
  handle text,
  bio text,
  avatar_url text,
  cover_url text,
  website text,
  is_verified boolean,
  verified_at timestamp with time zone,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
 )
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 
    id, user_id, name, handle, bio,
    avatar_url, cover_url, website,
    is_verified, verified_at,
    created_at, updated_at
  FROM public.profiles;
$function$;

CREATE FUNCTION public.get_public_profile(profile_user_id uuid)
 RETURNS TABLE(
  user_id uuid,
  name text,
  handle text,
  avatar_url text,
  bio text,
  cover_url text,
  website text,
  is_verified boolean,
  verified_at timestamp with time zone,
  created_at timestamp with time zone,
  is_founding_member boolean,
  founding_number integer
 )
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 
    p.user_id,
    p.name,
    p.handle,
    p.avatar_url,
    p.bio,
    p.cover_url,
    p.website,
    p.is_verified,
    p.verified_at,
    p.created_at,
    p.is_founding_member,
    p.founding_number
  FROM public.profiles p
  WHERE p.user_id = profile_user_id;
$function$;

CREATE FUNCTION public.get_public_profile_by_profile_id(profile_id uuid)
 RETURNS TABLE(
  user_id uuid,
  name text,
  handle text,
  avatar_url text,
  bio text,
  cover_url text,
  website text,
  is_verified boolean,
  verified_at timestamp with time zone,
  created_at timestamp with time zone,
  is_founding_member boolean,
  founding_number integer
 )
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 
    p.user_id,
    p.name,
    p.handle,
    p.avatar_url,
    p.bio,
    p.cover_url,
    p.website,
    p.is_verified,
    p.verified_at,
    p.created_at,
    p.is_founding_member,
    p.founding_number
  FROM public.profiles p
  WHERE p.id = profile_id;
$function$;

CREATE FUNCTION public.search_public_profiles(search_text text)
 RETURNS TABLE(
  id uuid,
  user_id uuid,
  handle text,
  name text,
  avatar_url text,
  bio text,
  is_verified boolean
 )
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  escaped_text text;
BEGIN
  IF search_text IS NULL OR search_text = '' THEN
    RETURN;
  END IF;

  escaped_text := replace(replace(replace(search_text, '\\', '\\\\'), '%', '\\%'), '_', '\\_');

  RETURN QUERY
  SELECT 
    p.id,
    p.user_id,
    p.handle,
    p.name,
    p.avatar_url,
    p.bio,
    p.is_verified
  FROM public.profiles p
  WHERE 
    p.name ILIKE '%' || escaped_text || '%' ESCAPE '\\'
    OR p.handle ILIKE '%' || escaped_text || '%' ESCAPE '\\'
  ORDER BY 
    CASE WHEN p.handle ILIKE escaped_text || '%' ESCAPE '\\' THEN 0
         WHEN p.name ILIKE escaped_text || '%' ESCAPE '\\' THEN 1
         ELSE 2
    END,
    p.name
  LIMIT 50;
END;
$function$;

CREATE FUNCTION public.get_creator_profiles(user_ids uuid[])
 RETURNS TABLE(
  user_id uuid,
  name text,
  avatar_url text,
  is_verified boolean
 )
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 
    p.user_id,
    p.name,
    p.avatar_url,
    p.is_verified
  FROM public.profiles p
  WHERE p.user_id = ANY(user_ids);
$function$;

CREATE FUNCTION public.get_following_list(target_user_id uuid)
 RETURNS TABLE(
  user_id uuid,
  name text,
  handle text,
  avatar_url text,
  is_verified boolean
 )
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 
    p.user_id,
    p.name,
    p.handle,
    p.avatar_url,
    p.is_verified
  FROM public.follows f
  JOIN public.profiles p ON p.user_id = f.following_id
  WHERE f.follower_id = target_user_id
  ORDER BY f.created_at DESC;
$function$;

CREATE FUNCTION public.get_followers_list(target_user_id uuid)
 RETURNS TABLE(
  user_id uuid,
  name text,
  handle text,
  avatar_url text,
  is_verified boolean
 )
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 
    p.user_id,
    p.name,
    p.handle,
    p.avatar_url,
    p.is_verified
  FROM public.follows f
  JOIN public.profiles p ON p.user_id = f.follower_id
  WHERE f.following_id = target_user_id
  ORDER BY f.created_at DESC;
$function$;

-- Column-level grants for public-safe field
GRANT SELECT (id, user_id, name, handle, bio, avatar_url, cover_url, website, is_verified, verified_at, created_at)
ON TABLE public.profiles TO anon, authenticated;