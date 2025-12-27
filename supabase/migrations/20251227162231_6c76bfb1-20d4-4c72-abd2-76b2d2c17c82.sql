-- Remove the overly permissive policy that exposes email
DROP POLICY IF EXISTS "Public can view profiles via view" ON public.profiles;

-- Drop the view - we'll use a function instead
DROP VIEW IF EXISTS public.public_profiles;

-- Create a SECURITY DEFINER function to safely return public profile data (excluding email)
CREATE OR REPLACE FUNCTION public.get_public_profile(profile_user_id UUID)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  name TEXT,
  handle TEXT,
  bio TEXT,
  avatar_url TEXT,
  cover_url TEXT,
  website TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    id, user_id, name, handle, bio, 
    avatar_url, cover_url, website,
    created_at, updated_at
  FROM public.profiles
  WHERE profiles.user_id = profile_user_id;
$$;

-- Create a function to get all public profiles (for discovery/listing)
CREATE OR REPLACE FUNCTION public.get_all_public_profiles()
RETURNS TABLE (
  id UUID,
  user_id UUID,
  name TEXT,
  handle TEXT,
  bio TEXT,
  avatar_url TEXT,
  cover_url TEXT,
  website TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    id, user_id, name, handle, bio, 
    avatar_url, cover_url, website,
    created_at, updated_at
  FROM public.profiles;
$$;