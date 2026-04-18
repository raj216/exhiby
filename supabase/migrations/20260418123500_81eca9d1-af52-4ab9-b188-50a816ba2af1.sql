-- Fix 1: Remove overly broad RLS policies on public.messages
-- These policies with `true` conditions completely override the conversation-scoped
-- policies via OR logic, allowing any authenticated user to read/insert any message.
DROP POLICY IF EXISTS "Authenticated users can use realtime" ON public.messages;
DROP POLICY IF EXISTS "Authenticated users can broadcast" ON public.messages;

-- Fix 2: Remove overly broad RLS policies on realtime.messages
-- These `true` policies allow any authenticated user to subscribe to any Realtime
-- channel and receive other users' sensitive data (notifications, feedback, DMs).
-- For postgres_changes subscriptions, the underlying table RLS already filters
-- row events per subscriber, so removing these policies does NOT break realtime
-- functionality on RLS-protected tables.
DROP POLICY IF EXISTS "Authenticated users can use realtime" ON realtime.messages;
DROP POLICY IF EXISTS "Authenticated users can broadcast" ON realtime.messages;