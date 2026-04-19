-- Enable RLS on realtime.messages and add scoped policies for channel subscriptions
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to subscribe/broadcast/presence on permitted topics only.
-- Topic conventions used by the app:
--   notifications-realtime-{user_id}        -> only that user
--   creator-earnings-{user_id}              -> only that user
--   typing:{conversation_id}                -> conversation participants
--   messages:{conversation_id}              -> conversation participants
--   reactions:{conversation_id}             -> conversation participants
--   live-room:{event_id} / live-chat:{event_id} / event-live-status-{event_id}
--     / live_viewers_{event_id} / live_materials_{event_id} / hand-raises-{event_id}
--     -> creator of event OR active viewer (heartbeat in last 30s)
--   creator-live-{creator_id}, creator-events-{creator_id}
--     -> any authenticated user (public discovery signal)
--   browse_events_realtime, schedule_events_realtime, explore_studios_events,
--     explore_studios_roles, live_events_changes, live_viewers_changes,
--     monthly-analytics, conversations-updates, live-notification-toasts
--     -> any authenticated user (broad public/discovery topics; row data still gated by table RLS)

CREATE POLICY "realtime_authenticated_topic_access"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  -- Per-user private topics
  (
    realtime.topic() = 'notifications-realtime-' || auth.uid()::text
    OR realtime.topic() = 'creator-earnings-' || auth.uid()::text
  )
  OR
  -- Conversation-scoped topics (typing / messages / reactions)
  (
    (
      realtime.topic() LIKE 'typing:%'
      OR realtime.topic() LIKE 'messages:%'
      OR realtime.topic() LIKE 'reactions:%'
    )
    AND public.is_conversation_participant(
      NULLIF(split_part(realtime.topic(), ':', 2), '')::uuid,
      auth.uid()
    )
  )
  OR
  -- Event-scoped live topics: creator OR active viewer
  (
    (
      realtime.topic() LIKE 'live-room:%'
      OR realtime.topic() LIKE 'live-chat:%'
      OR realtime.topic() LIKE 'event-live-status-%'
      OR realtime.topic() LIKE 'live_viewers_%'
      OR realtime.topic() LIKE 'live_materials_%'
      OR realtime.topic() LIKE 'hand-raises-%'
    )
    AND EXISTS (
      SELECT 1
      FROM public.events e
      WHERE e.id::text = regexp_replace(
              realtime.topic(),
              '^(live-room:|live-chat:|event-live-status-|live_viewers_|live_materials_|hand-raises-)',
              ''
            )
        AND (
          e.creator_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.live_viewers lv
            WHERE lv.event_id = e.id
              AND lv.user_id = auth.uid()
              AND lv.last_seen > now() - interval '30 seconds'
          )
        )
    )
  )
  OR
  -- Public discovery / aggregate topics (row content still protected by table RLS)
  realtime.topic() IN (
    'browse_events_realtime',
    'schedule_events_realtime',
    'explore_studios_events',
    'explore_studios_roles',
    'live_events_changes',
    'live_viewers_changes',
    'monthly-analytics',
    'conversations-updates',
    'live-notification-toasts'
  )
  OR realtime.topic() LIKE 'creator-live-%'
  OR realtime.topic() LIKE 'creator-events-%'
);