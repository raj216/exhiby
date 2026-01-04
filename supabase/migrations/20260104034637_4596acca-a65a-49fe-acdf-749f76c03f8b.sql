-- Fix SECURITY DEFINER functions to validate caller ownership

-- Update upsert_live_viewer to validate that the caller owns the user_id
CREATE OR REPLACE FUNCTION public.upsert_live_viewer(p_event_id uuid, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- CRITICAL: Validate caller owns the user_id
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Must be authenticated';
  END IF;
  
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: Cannot join as another user';
  END IF;
  
  INSERT INTO public.live_viewers (event_id, user_id, last_seen)
  VALUES (p_event_id, p_user_id, now())
  ON CONFLICT (event_id, user_id)
  DO UPDATE SET last_seen = now();
END;
$$;

-- Update remove_live_viewer to validate that the caller owns the user_id
CREATE OR REPLACE FUNCTION public.remove_live_viewer(p_event_id uuid, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- CRITICAL: Validate caller owns the user_id
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Must be authenticated';
  END IF;
  
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: Cannot remove another user';
  END IF;
  
  DELETE FROM public.live_viewers 
  WHERE event_id = p_event_id AND user_id = p_user_id;
END;
$$;