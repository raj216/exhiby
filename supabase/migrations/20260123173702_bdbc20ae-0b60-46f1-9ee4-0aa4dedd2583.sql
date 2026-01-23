-- Fix profile search RPC: drop + recreate to adjust return shape and correct ESCAPE usage
DROP FUNCTION IF EXISTS public.search_public_profiles(text);

CREATE FUNCTION public.search_public_profiles(search_text text)
RETURNS TABLE(
  id uuid,
  user_id uuid,
  handle text,
  name text,
  avatar_url text,
  bio text,
  is_verified boolean,
  account_type text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  escaped_text text;
BEGIN
  IF search_text IS NULL OR search_text = '' THEN
    RETURN;
  END IF;

  -- Escape backslash, %, and _ characters for ILIKE + ESCAPE '\'
  escaped_text := replace(
    replace(
      replace(search_text, E'\\', E'\\\\'),
      '%',
      E'\\%'
    ),
    '_',
    E'\\_'
  );

  RETURN QUERY
  SELECT
    p.id,
    p.user_id,
    p.handle,
    p.name,
    p.avatar_url,
    p.bio,
    p.is_verified,
    CASE
      WHEN EXISTS (
        SELECT 1
        FROM public.user_roles ur
        WHERE ur.user_id = p.user_id
          AND ur.role = 'creator'::public.app_role
      ) THEN 'creator'
      ELSE 'audience'
    END AS account_type
  FROM public.profiles p
  WHERE
    p.name ILIKE '%' || escaped_text || '%' ESCAPE E'\\'
    OR p.handle ILIKE '%' || escaped_text || '%' ESCAPE E'\\'
  ORDER BY
    CASE
      WHEN p.handle ILIKE escaped_text || '%' ESCAPE E'\\' THEN 0
      WHEN p.name ILIKE escaped_text || '%' ESCAPE E'\\' THEN 1
      ELSE 2
    END,
    p.name
  LIMIT 50;
END;
$$;