-- Drop and recreate the view with proper configuration
DROP VIEW IF EXISTS public.public_profiles;

-- Create the view with security_invoker from the start
CREATE VIEW public.public_profiles 
WITH (security_invoker = true)
AS
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

-- Grant SELECT on the view
GRANT SELECT ON public.public_profiles TO authenticated, anon;

-- Add a SELECT policy on the base profiles table to allow public viewing
-- This is needed because the view uses security_invoker mode
CREATE POLICY "Public can view profiles via view"
ON public.profiles
FOR SELECT
USING (true);