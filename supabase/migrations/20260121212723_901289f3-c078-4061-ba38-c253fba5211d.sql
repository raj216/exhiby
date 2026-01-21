-- 1) Profiles: allow public discovery WITHOUT exposing user_id by using column privileges
-- Grant only safe columns to anon/authenticated; keep user_id readable only by privileged roles.
REVOKE ALL ON TABLE public.profiles FROM anon, authenticated;
GRANT SELECT (id, created_at, updated_at, is_founding_member, founding_number, name, avatar_url, handle, bio, website, cover_url)
  ON TABLE public.profiles TO anon, authenticated;
GRANT INSERT, UPDATE ON TABLE public.profiles TO authenticated;

-- Ensure RLS is enabled (no-op if already enabled)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Public SELECT policy (works with column privileges to avoid leaking user_id)
DROP POLICY IF EXISTS "Public can view basic profiles" ON public.profiles;
CREATE POLICY "Public can view basic profiles"
ON public.profiles
FOR SELECT
USING (true);

-- 2) Tickets: allow direct INSERT only for free events (paid must be minted server-side after payment verification)
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert tickets for free events" ON public.tickets;
CREATE POLICY "Users can insert tickets for free events"
ON public.tickets
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1
    FROM public.events e
    WHERE e.id = tickets.event_id
      AND (e.is_free = true OR COALESCE(e.price, 0) <= 0)
  )
);

-- 3) Notifications: allow INSERT only for service-role JWT calls (regular users cannot spoof notifications)
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can insert notifications" ON public.notifications;
CREATE POLICY "Service role can insert notifications"
ON public.notifications
FOR INSERT
WITH CHECK ((auth.jwt() ->> 'role') = 'service_role');
