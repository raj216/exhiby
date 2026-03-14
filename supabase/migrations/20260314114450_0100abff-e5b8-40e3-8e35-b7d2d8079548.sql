
DROP POLICY "Users can insert their own messages" ON public.live_messages;

CREATE POLICY "Users can insert their own messages"
ON public.live_messages
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND (
    -- Event creator can always post
    EXISTS (
      SELECT 1 FROM public.events
      WHERE events.id = live_messages.event_id
        AND events.creator_id = auth.uid()
    )
    OR
    -- Active viewer (heartbeat within last 30s)
    EXISTS (
      SELECT 1 FROM public.live_viewers
      WHERE live_viewers.event_id = live_messages.event_id
        AND live_viewers.user_id = auth.uid()
        AND live_viewers.last_seen > (now() - interval '30 seconds')
    )
  )
);
