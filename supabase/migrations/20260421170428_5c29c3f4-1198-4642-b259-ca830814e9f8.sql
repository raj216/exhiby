-- 1. Attach guard trigger to tickets table to prevent modification of financial fields
DROP TRIGGER IF EXISTS tickets_user_update_guard_trigger ON public.tickets;
CREATE TRIGGER tickets_user_update_guard_trigger
BEFORE UPDATE ON public.tickets
FOR EACH ROW
EXECUTE FUNCTION public.tickets_user_update_guard();

-- 2. Attach guard trigger to messages table to protect immutable columns
DROP TRIGGER IF EXISTS protect_message_columns_trigger ON public.messages;
CREATE TRIGGER protect_message_columns_trigger
BEFORE UPDATE ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.protect_message_columns();

-- 3. Tighten realtime topic access policy: remove broad shared channels
DROP POLICY IF EXISTS "realtime_authenticated_topic_access" ON realtime.messages;

CREATE POLICY "realtime_authenticated_topic_access"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  -- User-scoped personal channels
  (realtime.topic() = ('notifications-realtime-' || (auth.uid())::text))
  OR (realtime.topic() = ('creator-earnings-' || (auth.uid())::text))
  OR (realtime.topic() = ('creator-live-' || (auth.uid())::text))
  OR (realtime.topic() = ('creator-events-' || (auth.uid())::text))

  -- DM conversation-scoped channels (only participants)
  OR (
    (realtime.topic() LIKE 'typing:%'
     OR realtime.topic() LIKE 'messages:%'
     OR realtime.topic() LIKE 'reactions:%')
    AND public.is_conversation_participant(
      (NULLIF(split_part(realtime.topic(), ':', 2), ''))::uuid,
      auth.uid()
    )
  )

  -- Live room event-scoped channels (host or active viewer)
  OR (
    (realtime.topic() LIKE 'live-room:%'
     OR realtime.topic() LIKE 'live-chat:%'
     OR realtime.topic() LIKE 'event-live-status-%'
     OR realtime.topic() LIKE 'live_viewers_%'
     OR realtime.topic() LIKE 'live_materials_%'
     OR realtime.topic() LIKE 'hand-raises-%')
    AND EXISTS (
      SELECT 1 FROM public.events e
      WHERE (e.id)::text = regexp_replace(
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
            AND lv.last_seen > (now() - interval '30 seconds')
        )
      )
    )
  )
);