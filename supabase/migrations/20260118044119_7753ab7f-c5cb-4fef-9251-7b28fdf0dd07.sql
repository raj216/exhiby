-- Drop the overly permissive public SELECT policy
DROP POLICY IF EXISTS "Anyone can view public profile info" ON public.profiles;

-- Create secure RPC to fetch creator profiles by user IDs (for tickets hook)
CREATE OR REPLACE FUNCTION public.get_creator_profiles(user_ids uuid[])
RETURNS TABLE(user_id uuid, name text, avatar_url text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT 
    p.user_id,
    p.name,
    p.avatar_url
  FROM public.profiles p
  WHERE p.user_id = ANY(user_ids);
$$;