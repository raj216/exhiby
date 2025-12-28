-- Create search_public_profiles function (SECURITY DEFINER to bypass RLS)
CREATE OR REPLACE FUNCTION public.search_public_profiles(search_text text)
RETURNS TABLE(
  user_id uuid,
  handle text,
  name text,
  avatar_url text,
  bio text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    p.user_id,
    p.handle,
    p.name,
    p.avatar_url,
    p.bio
  FROM public.profiles p
  WHERE 
    search_text IS NOT NULL 
    AND search_text <> ''
    AND (
      p.name ILIKE '%' || search_text || '%'
      OR p.handle ILIKE '%' || search_text || '%'
    )
  ORDER BY 
    CASE WHEN p.handle ILIKE search_text || '%' THEN 0
         WHEN p.name ILIKE search_text || '%' THEN 1
         ELSE 2
    END,
    p.name
  LIMIT 50;
$$;