-- Drop the existing restrictive SELECT policies
DROP POLICY IF EXISTS "Creators can view their own events" ON public.events;
DROP POLICY IF EXISTS "Public can view future events" ON public.events;
DROP POLICY IF EXISTS "Public can view live events" ON public.events;

-- Create PERMISSIVE SELECT policies (combined with OR, so any one passing is enough)
CREATE POLICY "Creators can view their own events"
ON public.events
FOR SELECT
USING (auth.uid() = creator_id);

CREATE POLICY "Anyone can view future scheduled events"
ON public.events
FOR SELECT
USING (scheduled_at > now());

CREATE POLICY "Anyone can view live events"
ON public.events
FOR SELECT
USING (is_live = true AND room_url IS NOT NULL AND live_ended_at IS NULL);

-- Enable realtime for events table
ALTER TABLE public.events REPLICA IDENTITY FULL;

-- Add events to realtime publication (ignore if already added)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.events;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;