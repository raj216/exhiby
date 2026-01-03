-- Drop ALL existing SELECT policies on events table and recreate with explicit PERMISSIVE
DROP POLICY IF EXISTS "Anyone can view live events" ON public.events;
DROP POLICY IF EXISTS "Anyone can view recently ended events" ON public.events;
DROP POLICY IF EXISTS "Anyone can view future scheduled events" ON public.events;
DROP POLICY IF EXISTS "Creators can view their own events" ON public.events;

-- Recreate as explicitly PERMISSIVE policies so they work as OR conditions
-- Creators can always view their own events
CREATE POLICY "Creators can view their own events"
ON public.events
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (auth.uid() = creator_id);

-- Anyone authenticated can view events that are currently live
CREATE POLICY "Anyone can view live events"
ON public.events
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  is_live = true 
  AND room_url IS NOT NULL 
  AND live_ended_at IS NULL
);

-- Anyone authenticated can view recently ended events (30 min grace period)
CREATE POLICY "Anyone can view recently ended events"
ON public.events
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  room_url IS NOT NULL 
  AND live_ended_at IS NOT NULL 
  AND live_ended_at > (now() - interval '30 minutes')
);

-- Anyone authenticated can view future scheduled events
CREATE POLICY "Anyone can view future scheduled events"
ON public.events
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (scheduled_at > now());