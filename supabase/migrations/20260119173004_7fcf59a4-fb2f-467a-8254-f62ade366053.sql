-- Drop the problematic SELECT policies on events that cause recursion
DROP POLICY IF EXISTS "Anyone can view live events" ON public.events;
DROP POLICY IF EXISTS "Anyone can view recently ended events" ON public.events;

-- Recreate policies without checking event_rooms (room_url existence is handled by the RPC)
-- Live events: just check is_live = true
CREATE POLICY "Anyone can view live events" 
ON public.events 
FOR SELECT 
USING (is_live = true AND live_ended_at IS NULL);

-- Recently ended events: check live_ended_at within 30 minutes
CREATE POLICY "Anyone can view recently ended events" 
ON public.events 
FOR SELECT 
USING (live_ended_at IS NOT NULL AND live_ended_at > (now() - interval '30 minutes'));