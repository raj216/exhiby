
-- Fix: Materials RLS policy blocks audience because it checks event_rooms which has creator-only RLS
-- Solution: Allow SELECT for active viewers (users with recent heartbeat in live_viewers) similar to chat

-- Drop the problematic SELECT policy
DROP POLICY IF EXISTS "Materials visible for accessible events" ON public.live_materials;

-- Create new policy that checks live_viewers for audience access (same pattern as chat)
CREATE POLICY "Materials visible for accessible events"
ON public.live_materials
FOR SELECT
USING (
  -- Creator can always see their event's materials
  EXISTS (
    SELECT 1 FROM events e 
    WHERE e.id = live_materials.event_id 
    AND e.creator_id = auth.uid()
  )
  OR
  -- Active participants (viewers with recent heartbeat) can see materials during live events
  (
    EXISTS (
      SELECT 1 FROM events e 
      WHERE e.id = live_materials.event_id 
      AND (
        -- Event is currently live
        (e.is_live = true AND e.live_ended_at IS NULL)
        OR
        -- Event is scheduled (pre-live)
        e.scheduled_at > now()
        OR
        -- Event ended recently (30min grace)
        (e.live_ended_at IS NOT NULL AND e.live_ended_at > (now() - interval '30 minutes'))
      )
    )
    AND
    EXISTS (
      SELECT 1 FROM live_viewers lv 
      WHERE lv.event_id = live_materials.event_id 
      AND lv.user_id = auth.uid()
      AND lv.last_seen > (now() - interval '30 seconds')
    )
  )
);
