-- Create RPC to look up public profile by handle
CREATE OR REPLACE FUNCTION public.get_public_profile_by_handle(target_handle text)
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
    p.website,
    p.is_verified,
    p.verified_at,
    p.created_at,
    p.is_founding_member,
    p.founding_number
  FROM public.profiles p
  WHERE LOWER(p.handle) = LOWER(target_handle)
  LIMIT 1;
$$;