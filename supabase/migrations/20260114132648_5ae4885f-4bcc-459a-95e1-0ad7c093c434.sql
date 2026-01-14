-- =============================================================
-- SECURITY HARDENING MIGRATION
-- Fixes: notifications INSERT, live_viewers SELECT policies
-- =============================================================

-- 1. FIX NOTIFICATIONS TABLE - Replace permissive INSERT policy with SECURITY DEFINER function
-- Drop the vulnerable policy
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;

-- Create a secure SECURITY DEFINER function for inserting notifications
CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_message text DEFAULT NULL,
  p_link text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id uuid;
BEGIN
  -- Validate inputs
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id is required';
  END IF;
  
  IF p_type IS NULL OR p_type = '' THEN
    RAISE EXCEPTION 'type is required';
  END IF;
  
  IF p_title IS NULL OR p_title = '' THEN
    RAISE EXCEPTION 'title is required';
  END IF;
  
  INSERT INTO public.notifications (user_id, type, title, message, link)
  VALUES (p_user_id, p_type, p_title, p_message, p_link)
  RETURNING id INTO new_id;
  
  RETURN new_id;
END;
$$;

-- 2. FIX LIVE VIEWERS SELECT - Allow creators to see viewers of their events
-- Drop the restrictive policy
DROP POLICY IF EXISTS "Users can view their own viewer record" ON public.live_viewers;

-- Create more permissive SELECT policy:
-- Users can see their own records OR creators can see viewers of their events
CREATE POLICY "Users and creators can view viewer records"
ON public.live_viewers FOR SELECT
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.events
    WHERE events.id = live_viewers.event_id
    AND events.creator_id = auth.uid()
  )
);

-- 3. Create RPC for audience stats to work with restricted access
CREATE OR REPLACE FUNCTION public.get_user_attendance_count(target_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(DISTINCT event_id)::integer
  FROM public.live_viewers
  WHERE user_id = target_user_id;
$$;

-- 4. Create RPC for creator to get viewer list for their events
CREATE OR REPLACE FUNCTION public.get_event_viewers(p_event_id uuid)
RETURNS TABLE(
  user_id uuid,
  joined_at timestamp with time zone,
  last_seen timestamp with time zone
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    lv.user_id,
    lv.joined_at,
    lv.last_seen
  FROM public.live_viewers lv
  INNER JOIN public.events e ON e.id = lv.event_id
  WHERE lv.event_id = p_event_id
  AND e.creator_id = auth.uid()
  ORDER BY lv.last_seen DESC;
$$;