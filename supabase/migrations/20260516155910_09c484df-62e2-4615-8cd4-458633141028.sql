
-- 1) creator_earnings: hide buyer identity & stripe identifiers via column-level REVOKE
REVOKE SELECT (user_id, stripe_payment_intent_id, stripe_event_id, stripe_checkout_session_id)
  ON public.creator_earnings FROM anon, authenticated;

-- 2) tickets: attach guard trigger so only attended_at is mutable
DROP TRIGGER IF EXISTS tickets_user_update_guard_trigger ON public.tickets;
CREATE TRIGGER tickets_user_update_guard_trigger
  BEFORE UPDATE ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.tickets_user_update_guard();

-- 3) Realtime live-room topic policy: re-check ticket validity for paid events
DROP POLICY IF EXISTS "realtime_authenticated_topic_access" ON realtime.messages;
CREATE POLICY "realtime_authenticated_topic_access"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  (realtime.topic() = ('notifications-realtime-'::text || (auth.uid())::text))
  OR (realtime.topic() = ('creator-earnings-'::text || (auth.uid())::text))
  OR (realtime.topic() = ('creator-live-'::text || (auth.uid())::text))
  OR (realtime.topic() = ('creator-events-'::text || (auth.uid())::text))
  OR (realtime.topic() = ('monthly-analytics-'::text || (auth.uid())::text))
  OR (
    ((realtime.topic() ~~ 'typing:%'::text)
      OR (realtime.topic() ~~ 'messages:%'::text)
      OR (realtime.topic() ~~ 'reactions:%'::text))
    AND public.is_conversation_participant(
      (NULLIF(split_part(realtime.topic(), ':'::text, 2), ''::text))::uuid,
      auth.uid()
    )
  )
  OR (
    ((realtime.topic() ~~ 'live-room:%'::text)
      OR (realtime.topic() ~~ 'live-chat:%'::text)
      OR (realtime.topic() ~~ 'event-live-status-%'::text)
      OR (realtime.topic() ~~ 'live_viewers_%'::text)
      OR (realtime.topic() ~~ 'live_materials_%'::text)
      OR (realtime.topic() ~~ 'hand-raises-%'::text))
    AND (EXISTS (
      SELECT 1 FROM public.events e
      WHERE ((e.id)::text = regexp_replace(
              realtime.topic(),
              '^(live-room:|live-chat:|event-live-status-|live_viewers_|live_materials_|hand-raises-)'::text,
              ''::text))
        AND (
          -- Creator always allowed
          e.creator_id = auth.uid()
          OR (
            -- Active viewer heartbeat
            EXISTS (
              SELECT 1 FROM public.live_viewers lv
              WHERE lv.event_id = e.id
                AND lv.user_id = auth.uid()
                AND lv.last_seen > (now() - interval '30 seconds')
            )
            -- AND for paid events, must hold a confirmed ticket
            AND (
              COALESCE(e.is_free, false) = true
              OR COALESCE(e.price, 0) <= 0
              OR EXISTS (
                SELECT 1 FROM public.tickets t
                WHERE t.event_id = e.id
                  AND t.user_id = auth.uid()
                  AND t.payment_status IN ('paid', 'free')
              )
            )
          )
        )
    ))
  )
  OR (realtime.topic() = ANY (ARRAY[
    'browse_events_realtime'::text,
    'schedule_events_realtime'::text,
    'explore_studios_events'::text,
    'live_events_changes'::text
  ]))
);

-- 4) account_deletions: allow admins to audit deletion reasons
CREATE POLICY "Admins can view account deletions"
ON public.account_deletions
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));
