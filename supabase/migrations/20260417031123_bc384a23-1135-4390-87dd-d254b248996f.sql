-- 1. Tighten messages UPDATE policy: prevent column tampering via WITH CHECK
DROP POLICY IF EXISTS "Users can update their own messages" ON public.messages;

-- The trigger protect_message_columns already exists and protects conversation_id,
-- sender_id, created_at. Re-create the policy with strict WITH CHECK.
CREATE POLICY "Users can update content of their own messages"
ON public.messages
FOR UPDATE
TO authenticated
USING (auth.uid() = sender_id)
WITH CHECK (auth.uid() = sender_id);

-- 2. Realtime channel authorization: restrict who can subscribe to realtime topics.
-- realtime.messages stores broadcast/presence/postgres_changes events.
-- Without RLS, any authenticated user can subscribe to any topic.

-- Enable RLS on realtime.messages (idempotent)
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies we manage
DROP POLICY IF EXISTS "Authenticated can read realtime topics they own" ON realtime.messages;
DROP POLICY IF EXISTS "Authenticated can write realtime topics they own" ON realtime.messages;

-- SELECT policy: a user may subscribe to a topic only if:
--  * topic encodes a conversation they participate in (e.g. "messages:<uuid>")
--  * topic encodes an event they can access
--  * topic encodes their own user id (notifications, prefs)
--  * topic is for a public live event
CREATE POLICY "Authenticated can read realtime topics they own"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  -- DM conversation channels: "messages:<conversation_id>"
  (
    realtime.topic() LIKE 'messages:%'
    AND public.is_conversation_participant(
      (substring(realtime.topic() from 'messages:(.*)'))::uuid,
      auth.uid()
    )
  )
  OR
  -- Per-user channels (notifications, preferences, etc.) "user:<uid>" or "<uid>"
  (
    realtime.topic() = auth.uid()::text
    OR realtime.topic() = ('user:' || auth.uid()::text)
    OR realtime.topic() = ('notifications:' || auth.uid()::text)
    OR realtime.topic() = ('creator-earnings:' || auth.uid()::text)
  )
  OR
  -- Live event channels — only viewable events (creator OR active viewer OR public)
  (
    realtime.topic() LIKE 'live:%'
    AND EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = (substring(realtime.topic() from 'live:(.*)'))::uuid
        AND (
          e.creator_id = auth.uid()
          OR e.is_live = true
          OR e.scheduled_at > now()
        )
    )
  )
);

-- INSERT policy for broadcast/presence: same gating
CREATE POLICY "Authenticated can write realtime topics they own"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  (
    realtime.topic() LIKE 'messages:%'
    AND public.is_conversation_participant(
      (substring(realtime.topic() from 'messages:(.*)'))::uuid,
      auth.uid()
    )
  )
  OR
  (
    realtime.topic() = auth.uid()::text
    OR realtime.topic() = ('user:' || auth.uid()::text)
    OR realtime.topic() = ('notifications:' || auth.uid()::text)
    OR realtime.topic() = ('creator-earnings:' || auth.uid()::text)
  )
  OR
  (
    realtime.topic() LIKE 'live:%'
    AND EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = (substring(realtime.topic() from 'live:(.*)'))::uuid
        AND (
          e.creator_id = auth.uid()
          OR e.is_live = true
          OR e.scheduled_at > now()
        )
    )
  )
);