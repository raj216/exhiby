-- Drop the overly strict topic-based policies that don't match the app's
-- actual channel naming conventions and would break realtime subscriptions
-- across live events, browse, schedule, and profile pages.
DROP POLICY IF EXISTS "Authenticated can read realtime topics they own" ON realtime.messages;
DROP POLICY IF EXISTS "Authenticated can write realtime topics they own" ON realtime.messages;

-- Permissive policy for authenticated users.
-- Rationale:
--   * For postgres_changes, Supabase still applies the source table's RLS,
--     so users only receive rows they're allowed to SELECT.
--   * Anonymous users remain blocked (no policy for `anon`).
--   * Broadcast/presence topics in this app are non-sensitive
--     (live chat, typing indicators, hand raises) and already gated by
--     table-level RLS on the underlying writes.
CREATE POLICY "Authenticated users can use realtime"
ON realtime.messages
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can broadcast"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (true);