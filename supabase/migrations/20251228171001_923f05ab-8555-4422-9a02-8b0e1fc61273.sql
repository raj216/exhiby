-- Add last_seen column to live_viewers for presence tracking
ALTER TABLE public.live_viewers ADD COLUMN IF NOT EXISTS last_seen timestamptz NOT NULL DEFAULT now();

-- Add viewer_profile_id for optional profile reference  
ALTER TABLE public.live_viewers ADD COLUMN IF NOT EXISTS viewer_profile_id uuid NULL;

-- Add unique constraint for event_id + user_id to prevent duplicates
ALTER TABLE public.live_viewers DROP CONSTRAINT IF EXISTS live_viewers_event_user_unique;
ALTER TABLE public.live_viewers ADD CONSTRAINT live_viewers_event_user_unique UNIQUE (event_id, user_id);

-- Create index on last_seen for efficient stale viewer cleanup queries
CREATE INDEX IF NOT EXISTS idx_live_viewers_last_seen ON public.live_viewers(last_seen);
CREATE INDEX IF NOT EXISTS idx_live_viewers_event_id ON public.live_viewers(event_id);

-- Drop existing restrictive policies on live_viewers
DROP POLICY IF EXISTS "Users can view their own viewer record" ON public.live_viewers;
DROP POLICY IF EXISTS "Users can insert their own viewer record" ON public.live_viewers;
DROP POLICY IF EXISTS "Users can delete their own viewer record" ON public.live_viewers;

-- Create new policies for live_viewers
-- Anyone can read viewer counts (needed for real-time viewer count)
CREATE POLICY "Anyone can view live viewers"
ON public.live_viewers FOR SELECT
USING (true);

-- Authenticated users can insert their own viewer record
CREATE POLICY "Users can join as viewer"
ON public.live_viewers FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own viewer record (for heartbeat last_seen updates)
CREATE POLICY "Users can update their own viewer record"
ON public.live_viewers FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own viewer record (leave room)
CREATE POLICY "Users can leave as viewer"
ON public.live_viewers FOR DELETE
USING (auth.uid() = user_id);

-- Create a secure function to get active viewer count (with 30 second threshold)
CREATE OR REPLACE FUNCTION public.get_active_viewer_count(event_uuid uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER 
  FROM public.live_viewers 
  WHERE event_id = event_uuid 
  AND last_seen > (now() - interval '30 seconds');
$$;

-- Create a function to upsert viewer (join or update heartbeat)
CREATE OR REPLACE FUNCTION public.upsert_live_viewer(p_event_id uuid, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.live_viewers (event_id, user_id, last_seen)
  VALUES (p_event_id, p_user_id, now())
  ON CONFLICT (event_id, user_id)
  DO UPDATE SET last_seen = now();
END;
$$;

-- Create a function to remove viewer
CREATE OR REPLACE FUNCTION public.remove_live_viewer(p_event_id uuid, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.live_viewers 
  WHERE event_id = p_event_id AND user_id = p_user_id;
END;
$$;