-- Shared, timezone-safe upcoming sessions query (uses DB now() and a 10-minute grace window)
-- NOTE: There is currently no explicit "visibility" or "cancelled" field on public.events.
-- - Visibility: treated as public by default (existing RLS policies already govern what rows are readable)
-- - Cancelled: treated as not-cancelled (cancellation is effectively modeled via deletion today)

CREATE OR REPLACE FUNCTION public.get_upcoming_sessions(
  p_creator_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 50
)
RETURNS TABLE(
  id uuid,
  title text,
  cover_url text,
  scheduled_at timestamptz,
  is_free boolean,
  price numeric,
  category text,
  creator_id uuid,
  is_live boolean,
  live_ended_at timestamptz,
  status text
)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT
    e.id,
    e.title,
    e.cover_url,
    e.scheduled_at,
    e.is_free,
    e.price,
    e.category,
    e.creator_id,
    COALESCE(e.is_live, false) AS is_live,
    e.live_ended_at,
    CASE
      WHEN COALESCE(e.is_live, false) = true AND e.live_ended_at IS NULL THEN 'live'
      ELSE 'scheduled'
    END AS status
  FROM public.events e
  WHERE
    -- optional creator scoping
    (p_creator_id IS NULL OR e.creator_id = p_creator_id)
    -- start_time exists
    AND e.scheduled_at IS NOT NULL
    -- not ended
    AND e.live_ended_at IS NULL
    -- status in ('scheduled','live')
    AND (
      -- scheduled: starting in the future OR within grace window, and not live
      (
        COALESCE(e.is_live, false) = false
        AND e.scheduled_at >= (now() - interval '10 minutes')
      )
      OR
      -- live: creator started stream
      (COALESCE(e.is_live, false) = true)
    )
  ORDER BY e.scheduled_at ASC
  LIMIT LEAST(GREATEST(p_limit, 1), 200);
$$;