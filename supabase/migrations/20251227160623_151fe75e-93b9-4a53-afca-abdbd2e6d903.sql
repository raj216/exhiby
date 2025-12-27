-- ===========================================
-- FIX 1: Profiles table - allow public viewing of non-sensitive fields
-- ===========================================

-- Create a view that exposes only public profile data (excludes email)
CREATE VIEW public.public_profiles AS
SELECT 
  id,
  user_id,
  name,
  handle,
  bio,
  avatar_url,
  cover_url,
  website,
  created_at,
  updated_at
FROM public.profiles;

-- Grant SELECT on the view to authenticated and anon roles
GRANT SELECT ON public.public_profiles TO authenticated, anon;

-- ===========================================
-- FIX 2: Live viewers - restrict SELECT to prevent user tracking
-- ===========================================

-- Drop the overly permissive policy that exposes user viewing behavior
DROP POLICY IF EXISTS "Anyone can view live viewers count" ON public.live_viewers;

-- Add restrictive policy: users can only see their own viewer records
CREATE POLICY "Users can view their own viewer record"
ON public.live_viewers
FOR SELECT
USING (auth.uid() = user_id);