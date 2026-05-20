
DROP POLICY IF EXISTS realtime_authenticated_topic_access ON realtime.messages;

CREATE POLICY realtime_authenticated_topic_access
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  (realtime.topic() = ('notifications-realtime-' || (auth.uid())::text))
  OR (realtime.topic() = ('creator-earnings-' || (auth.uid())::text))
  OR (realtime.topic() = ('creator-live-' || (auth.uid())::text))
  OR (realtime.topic() = ('creator-events-' || (auth.uid())::text))
  OR (realtime.topic() = ('monthly-analytics-' || (auth.uid())::text))
  OR (
    (
      (realtime.topic() LIKE 'typing:%')
      OR (realtime.topic() LIKE 'messages:%')
      OR (realtime.topic() LIKE 'reactions:%')
    )
    AND public.is_conversation_participant(
      (NULLIF(split_part(realtime.topic(), ':', 2), ''))::uuid,
      auth.uid()
    )
  )
  OR (
    (
      (realtime.topic() LIKE 'live-room:%')
      OR (realtime.topic() LIKE 'live-chat:%')
      OR (realtime.topic() LIKE 'event-live-status-%')
      OR (realtime.topic() LIKE 'live_viewers_%')
      OR (realtime.topic() LIKE 'live_materials_%')
      OR (realtime.topic() LIKE 'hand-raises-%')
    )
    AND EXISTS (
      SELECT 1
      FROM public.events e
      WHERE (e.id)::text = regexp_replace(
              realtime.topic(),
              '^(live-room:|live-chat:|event-live-status-|live_viewers_|live_materials_|hand-raises-)',
              ''
            )
        AND (
          e.creator_id = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.live_viewers lv
            WHERE lv.event_id = e.id
              AND lv.user_id = auth.uid()
              AND lv.last_seen > (now() - interval '30 seconds')
          )
        )
    )
  )
  OR (realtime.topic() = ANY (ARRAY[
    'browse_events_realtime',
    'schedule_events_realtime',
    'explore_studios_events',
    'live_events_changes'
  ]))
);
