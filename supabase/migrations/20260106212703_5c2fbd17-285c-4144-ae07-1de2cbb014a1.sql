-- Fix live_messages SELECT policy to restrict access to active participants only
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Authenticated users can read messages" ON public.live_messages;

-- Create restrictive policy: only event creator OR active viewers can read messages
CREATE POLICY "Active participants can read messages"
ON public.live_messages FOR SELECT TO authenticated
USING (
  -- User is the event creator
  EXISTS (
    SELECT 1 FROM public.events 
    WHERE events.id = live_messages.event_id 
    AND events.creator_id = auth.uid()
  )
  OR
  -- User is an active viewer (last_seen within 30 seconds)
  EXISTS (
    SELECT 1 FROM public.live_viewers 
    WHERE live_viewers.event_id = live_messages.event_id 
    AND live_viewers.user_id = auth.uid()
    AND live_viewers.last_seen > (now() - interval '30 seconds')
  )
);