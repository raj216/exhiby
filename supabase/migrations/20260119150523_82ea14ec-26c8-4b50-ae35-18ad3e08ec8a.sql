-- Drop the existing events_public view 
DROP VIEW IF EXISTS public.events_public;

-- Recreate as a proper SECURITY INVOKER VIEW excluding room_url
CREATE VIEW public.events_public
WITH (security_invoker=on) AS
  SELECT 
    id,
    creator_id,
    scheduled_at,
    is_free,
    price,
    created_at,
    updated_at,
    end_time,
    duration_minutes,
    is_live,
    live_started_at,
    viewer_count,
    live_ended_at,
    title,
    description,
    category,
    cover_url
  FROM public.events;
-- Note: room_url is intentionally excluded to prevent exposure of live room URLs
-- The view inherits RLS from the underlying events table due to security_invoker=on