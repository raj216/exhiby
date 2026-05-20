
-- Remove tables from realtime publication that are not subscribed via realtime in client code.
-- This prevents unintended broadcast of private user data.
ALTER PUBLICATION supabase_realtime DROP TABLE public.notification_preferences;
ALTER PUBLICATION supabase_realtime DROP TABLE public.saved_sessions;
