-- Fix SQL Injection in search_public_profiles by escaping ILIKE wildcards
-- Fix Viewer Cleanup by adding auto-cleanup trigger when stream ends
-- Add validation to founding member function

-- 1. Fix SQL Injection in Profile Search - escape wildcards
CREATE OR REPLACE FUNCTION public.search_public_profiles(search_text text)
RETURNS TABLE(id uuid, user_id uuid, handle text, name text, avatar_url text, bio text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  escaped_text text;
BEGIN
  -- Return empty if no search text
  IF search_text IS NULL OR search_text = '' THEN
    RETURN;
  END IF;
  
  -- Escape backslash, %, and _ characters to prevent ILIKE injection
  escaped_text := replace(replace(replace(search_text, '\', '\\'), '%', '\%'), '_', '\_');
  
  RETURN QUERY
  SELECT 
    p.id,
    p.user_id,
    p.handle,
    p.name,
    p.avatar_url,
    p.bio
  FROM public.profiles p
  WHERE 
    p.name ILIKE '%' || escaped_text || '%' ESCAPE '\'
    OR p.handle ILIKE '%' || escaped_text || '%' ESCAPE '\'
  ORDER BY 
    CASE WHEN p.handle ILIKE escaped_text || '%' ESCAPE '\' THEN 0
         WHEN p.name ILIKE escaped_text || '%' ESCAPE '\' THEN 1
         ELSE 2
    END,
    p.name
  LIMIT 50;
END;
$$;

-- 2. Create trigger to auto-cleanup viewers when stream ends
CREATE OR REPLACE FUNCTION public.cleanup_ended_stream_viewers()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- When stream ends (is_live changes from true to false), delete all viewers
  IF NEW.is_live = false AND OLD.is_live = true THEN
    DELETE FROM public.live_viewers WHERE event_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS cleanup_viewers_on_stream_end ON public.events;

CREATE TRIGGER cleanup_viewers_on_stream_end
AFTER UPDATE OF is_live ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.cleanup_ended_stream_viewers();

-- 3. Add validation to founding member function
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
  -- Ensure this is being called from trigger context only
  IF TG_OP IS NULL THEN
    RAISE EXCEPTION 'This function can only be called from a trigger';
  END IF;
  
  -- Validate the NEW record has valid user_id
  IF NEW.user_id IS NULL THEN
    RAISE EXCEPTION 'Invalid user_id in trigger context';
  END IF;

  -- Lock to prevent race conditions
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