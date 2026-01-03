-- Drop the existing restrictive SELECT policies
DROP POLICY IF EXISTS "Anyone can view live events" ON public.events;
DROP POLICY IF EXISTS "Anyone can view recently ended events" ON public.events;
DROP POLICY IF EXISTS "Anyone can view future scheduled events" ON public.events;
DROP POLICY IF EXISTS "Creators can view their own events" ON public.events;

-- Recreate as PERMISSIVE policies (default) so they work as OR conditions
-- Users can see events if ANY of these conditions match

-- Creators can always view their own events
CREATE POLICY "Creators can view their own events"
ON public.events
FOR SELECT
USING (auth.uid() = creator_id);

-- Anyone can view events that are currently live
CREATE POLICY "Anyone can view live events"
ON public.events
FOR SELECT
USING (
  is_live = true 
  AND room_url IS NOT NULL 
  AND live_ended_at IS NULL
);

-- Anyone can view recently ended events (30 min grace period)
CREATE POLICY "Anyone can view recently ended events"
ON public.events
FOR SELECT
USING (
  room_url IS NOT NULL 
  AND live_ended_at IS NOT NULL 
  AND live_ended_at > (now() - interval '30 minutes')
);

-- Anyone can view future scheduled events
CREATE POLICY "Anyone can view future scheduled events"
ON public.events
FOR SELECT
USING (scheduled_at > now());