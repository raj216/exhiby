-- Fix PUBLIC_DATA_EXPOSURE: materials_event_leak
-- Drop the overly permissive policy that allows anyone to view all materials
DROP POLICY IF EXISTS "Anyone can view materials" ON public.live_materials;

-- Create a restricted policy that only shows materials for accessible events
CREATE POLICY "Materials visible for accessible events"
ON public.live_materials FOR SELECT
USING (
  -- Creator can always see their materials
  EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = live_materials.event_id
    AND e.creator_id = auth.uid()
  )
  OR
  -- Materials visible when event is publicly accessible
  EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = live_materials.event_id
    AND (
      -- Event is currently live
      (e.is_live = true AND e.room_url IS NOT NULL AND e.live_ended_at IS NULL)
      OR
      -- Event is scheduled for future (publicly listed)
      (e.scheduled_at > now())
      OR
      -- Recently ended (30 min grace period)
      (e.live_ended_at IS NOT NULL AND e.live_ended_at > now() - interval '30 minutes')
    )
  )
);