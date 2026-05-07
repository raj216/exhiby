-- ─────────────────────────────────────────────────────────────────────────────
-- Add profile_links to public profile RPCs
-- ─────────────────────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.get_public_profile(uuid);
DROP FUNCTION IF EXISTS public.get_public_profile_by_profile_id(uuid);

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
  founding_number integer,
  profile_links jsonb
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
    p.founding_number,
    p.profile_links
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
  founding_number integer,
  profile_links jsonb
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
    p.founding_number,
    p.profile_links
  FROM public.profiles p
  WHERE p.id = profile_id;
$function$;

GRANT EXECUTE ON FUNCTION public.get_public_profile(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_profile_by_profile_id(uuid) TO anon, authenticated;
