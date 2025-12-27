-- Add new columns to events table for live tracking
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS end_time TIMESTAMPTZ;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS duration_minutes INTEGER DEFAULT 60;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS is_live BOOLEAN DEFAULT false;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS live_started_at TIMESTAMPTZ;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS viewer_count INTEGER DEFAULT 0;

-- Create live_viewers table for presence tracking
CREATE TABLE IF NOT EXISTS public.live_viewers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  user_id UUID NOT NULL,
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(event_id, user_id)
);

-- Enable RLS on live_viewers
ALTER TABLE public.live_viewers ENABLE ROW LEVEL SECURITY;

-- RLS policies for live_viewers
CREATE POLICY "Users can insert their own viewer record"
ON public.live_viewers
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own viewer record"
ON public.live_viewers
FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Anyone can view live viewers count"
ON public.live_viewers
FOR SELECT
USING (true);

-- Update events RLS to allow public viewing of live events
CREATE POLICY "Public can view live events"
ON public.events
FOR SELECT
USING (is_live = true);

-- Function to get live viewer count
CREATE OR REPLACE FUNCTION public.get_live_viewer_count(event_uuid UUID)
RETURNS INTEGER
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER FROM public.live_viewers WHERE event_id = event_uuid;
$$;

-- Enable realtime for events table
ALTER PUBLICATION supabase_realtime ADD TABLE public.events;

-- Enable realtime for live_viewers table
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_viewers;