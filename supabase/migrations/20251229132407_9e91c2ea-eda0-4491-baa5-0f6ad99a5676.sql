-- Fix PUBLIC_DATA_EXPOSURE: Remove email from all public RPC function return types

-- 1. Update get_public_profile to exclude email
CREATE OR REPLACE FUNCTION public.get_public_profile(profile_user_id uuid)
 RETURNS TABLE(user_id uuid, name text, handle text, avatar_url text, bio text, cover_url text, website text, created_at timestamp with time zone, is_founding_member boolean, founding_number integer)
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
    p.created_at,
    p.is_founding_member,
    p.founding_number
  FROM public.profiles p
  WHERE p.user_id = profile_user_id;
$function$;

-- 2. Update get_public_profile_by_profile_id to exclude email
CREATE OR REPLACE FUNCTION public.get_public_profile_by_profile_id(profile_id uuid)
 RETURNS TABLE(user_id uuid, name text, handle text, avatar_url text, bio text, cover_url text, website text, created_at timestamp with time zone, is_founding_member boolean, founding_number integer)
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
    p.created_at,
    p.is_founding_member,
    p.founding_number
  FROM public.profiles p
  WHERE p.id = profile_id;
$function$;

-- 3. Update get_all_public_profiles to exclude email
CREATE OR REPLACE FUNCTION public.get_all_public_profiles()
 RETURNS TABLE(id uuid, user_id uuid, name text, handle text, bio text, avatar_url text, cover_url text, website text, created_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 
    id, user_id, name, handle, bio, 
    avatar_url, cover_url, website,
    created_at, updated_at
  FROM public.profiles;
$function$;