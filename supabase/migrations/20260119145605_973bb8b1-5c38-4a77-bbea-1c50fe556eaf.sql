-- Fix 1: Restrict profiles direct SELECT to owner only
-- Public access is already available through get_public_profile RPC
DROP POLICY IF EXISTS "Anyone can view public profile info" ON public.profiles;

-- Fix 2: Create a secure public view for events that excludes room_url
-- This prevents unauthorized users from seeing private video room URLs
CREATE OR REPLACE VIEW public.events_public 
WITH (security_invoker = true) AS
SELECT 
  id, 
  creator_id, 
  title, 
  description, 
  scheduled_at, 
  is_free, 
  price, 
  created_at, 
  updated_at, 
  end_time, 
  duration_minutes, 
  is_live, 
  live_started_at, 
  viewer_count, 
  live_ended_at, 
  cover_url, 
  category
  -- room_url is intentionally EXCLUDED for security
FROM public.events;

-- Create RPC to safely get room_url for authorized users only
CREATE OR REPLACE FUNCTION public.get_event_room_url(event_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room_url text;
  v_creator_id uuid;
  v_is_free boolean;
  v_has_ticket boolean;
BEGIN
  -- Get event details
  SELECT room_url, creator_id, is_free INTO v_room_url, v_creator_id, v_is_free
  FROM public.events
  WHERE id = event_id;
  
  -- If no event found, return null
  IF v_room_url IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Creator always has access
  IF auth.uid() = v_creator_id THEN
    RETURN v_room_url;
  END IF;
  
  -- For free events, any authenticated user has access
  IF v_is_free = true AND auth.uid() IS NOT NULL THEN
    RETURN v_room_url;
  END IF;
  
  -- For paid events, check if user has a ticket
  SELECT EXISTS (
    SELECT 1 FROM public.tickets 
    WHERE tickets.event_id = get_event_room_url.event_id 
    AND tickets.user_id = auth.uid()
  ) INTO v_has_ticket;
  
  IF v_has_ticket THEN
    RETURN v_room_url;
  END IF;
  
  -- Unauthorized - return null
  RETURN NULL;
END;
$$;