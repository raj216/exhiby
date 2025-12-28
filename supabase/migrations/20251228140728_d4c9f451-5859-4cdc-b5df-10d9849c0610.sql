-- Add founding member fields to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_founding_member boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS founding_number integer NULL;

-- Create a function to assign founding member badge (concurrency-safe)
CREATE OR REPLACE FUNCTION public.assign_founding_member()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_count integer;
  next_number integer;
BEGIN
  -- Lock the profiles table to prevent race conditions
  -- Use advisory lock for better concurrency control
  PERFORM pg_advisory_xact_lock(hashtext('founding_member_assignment'));
  
  -- Count current founding members
  SELECT COUNT(*) INTO current_count 
  FROM public.profiles 
  WHERE is_founding_member = true;
  
  -- If we haven't reached 200 founding members yet
  IF current_count < 200 THEN
    next_number := current_count + 1;
    
    -- Update the newly inserted profile
    UPDATE public.profiles 
    SET is_founding_member = true, 
        founding_number = next_number
    WHERE user_id = NEW.user_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger that fires AFTER profile is inserted
DROP TRIGGER IF EXISTS assign_founding_member_trigger ON public.profiles;
CREATE TRIGGER assign_founding_member_trigger
AFTER INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.assign_founding_member();

-- Update get_public_profile to include founding member fields
DROP FUNCTION IF EXISTS public.get_public_profile(uuid);
CREATE OR REPLACE FUNCTION public.get_public_profile(profile_user_id uuid)
RETURNS TABLE(
  user_id uuid, 
  name text, 
  handle text, 
  avatar_url text, 
  bio text, 
  cover_url text, 
  website text, 
  created_at timestamptz,
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
    p.created_at,
    p.is_founding_member,
    p.founding_number
  FROM public.profiles p
  WHERE p.user_id = profile_user_id;
$$;

-- Update get_public_profile_by_profile_id
DROP FUNCTION IF EXISTS public.get_public_profile_by_profile_id(uuid);
CREATE OR REPLACE FUNCTION public.get_public_profile_by_profile_id(profile_id uuid)
RETURNS TABLE(
  user_id uuid, 
  name text, 
  handle text, 
  avatar_url text, 
  bio text, 
  cover_url text, 
  website text, 
  created_at timestamptz,
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
    p.created_at,
    p.is_founding_member,
    p.founding_number
  FROM public.profiles p
  WHERE p.id = profile_id;
$$;

-- Backfill existing users as founding members (ordered by created_at)
WITH numbered_profiles AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (ORDER BY created_at ASC) as rn
  FROM public.profiles
  WHERE is_founding_member IS NOT TRUE
)
UPDATE public.profiles p
SET 
  is_founding_member = true,
  founding_number = np.rn
FROM numbered_profiles np
WHERE p.id = np.id
AND np.rn <= 200;