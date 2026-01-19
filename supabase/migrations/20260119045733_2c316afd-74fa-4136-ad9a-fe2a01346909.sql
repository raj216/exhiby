-- Fix #1: Restore public SELECT policy for profiles table
-- The profiles table only contains public-facing data (name, handle, bio, avatar_url, etc.)
-- No sensitive data like email is stored here - it's a social platform where profiles are discoverable
CREATE POLICY "Anyone can view public profile info"
ON public.profiles
FOR SELECT
USING (true);

-- Fix #2: Add RLS policies to sent_emails table
-- This table tracks email deduplication and should only be accessible by:
-- 1. Users viewing their own email records
-- 2. Event creators viewing emails sent for their events (for analytics)

CREATE POLICY "Users can view their own sent emails"
ON public.sent_emails
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Creators can view sent emails for their events"
ON public.sent_emails
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM events
    WHERE events.id = sent_emails.event_id
    AND events.creator_id = auth.uid()
  )
);

-- INSERT is done via service role in edge functions, no user policy needed
-- No UPDATE or DELETE needed - email records are immutable audit logs