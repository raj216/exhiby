-- Function to get list of users that a user is following
CREATE OR REPLACE FUNCTION public.get_following_list(target_user_id uuid)
RETURNS TABLE(
  user_id uuid,
  name text,
  handle text,
  avatar_url text
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
    p.avatar_url
  FROM public.follows f
  JOIN public.profiles p ON p.user_id = f.following_id
  WHERE f.follower_id = target_user_id
  ORDER BY f.created_at DESC;
$$;

-- Function to get list of users following a user
CREATE OR REPLACE FUNCTION public.get_followers_list(target_user_id uuid)
RETURNS TABLE(
  user_id uuid,
  name text,
  handle text,
  avatar_url text
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
    p.avatar_url
  FROM public.follows f
  JOIN public.profiles p ON p.user_id = f.follower_id
  WHERE f.following_id = target_user_id
  ORDER BY f.created_at DESC;
$$;