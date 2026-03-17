
-- 1. Restrict create_notification to service_role only
REVOKE EXECUTE ON FUNCTION public.create_notification FROM authenticated, anon;

-- 2. Fix live chat role spoofing: update INSERT policy to enforce correct role
DROP POLICY IF EXISTS "Users can insert their own messages" ON public.live_messages;

CREATE POLICY "Users can insert their own messages"
ON public.live_messages
FOR INSERT
TO authenticated
WITH CHECK (
  (auth.uid() = user_id)
  AND (
    -- Creator can use role='creator'
    (
      role = 'creator'
      AND EXISTS (
        SELECT 1 FROM events
        WHERE events.id = live_messages.event_id
        AND events.creator_id = auth.uid()
      )
    )
    OR
    -- Viewers must use role='viewer' and be active viewers
    (
      role = 'viewer'
      AND EXISTS (
        SELECT 1 FROM live_viewers
        WHERE live_viewers.event_id = live_messages.event_id
        AND live_viewers.user_id = auth.uid()
        AND live_viewers.last_seen > (now() - interval '30 seconds')
      )
    )
  )
);
