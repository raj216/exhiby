-- Fix: Follow Relationships Exposed to All Users
-- Replace overly permissive policy with user-scoped access

DROP POLICY IF EXISTS "Anyone can view follows" ON public.follows;

CREATE POLICY "Users can view related follows"
ON public.follows
FOR SELECT
USING (
  auth.uid() = follower_id OR 
  auth.uid() = following_id
);