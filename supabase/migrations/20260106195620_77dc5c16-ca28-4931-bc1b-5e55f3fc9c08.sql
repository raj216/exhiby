-- Add public SELECT policy for profiles to enable social discovery
-- This is safe because: 
-- 1. Email column was already removed in migration 20260104024115
-- 2. UPDATE/INSERT/DELETE remain restricted to profile owners only
-- 3. Profiles on social platforms are meant to be publicly discoverable

CREATE POLICY "Anyone can view public profile info"
ON public.profiles
FOR SELECT
USING (true);