-- Drop existing function and recreate with description field
DROP FUNCTION IF EXISTS public.get_upcoming_sessions(uuid, integer);

CREATE FUNCTION public.get_upcoming_sessions(p_creator_id uuid DEFAULT NULL::uuid, p_limit integer DEFAULT 50)
 RETURNS TABLE(id uuid, title text, cover_url text, scheduled_at timestamp with time zone, is_free boolean, price numeric, category text, creator_id uuid, is_live boolean, live_ended_at timestamp with time zone, status text, description text)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
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
    END AS status,
    e.description
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
$function$;