
-- Create a new function to get accurate creator stats including unique guests from live_viewers
CREATE OR REPLACE FUNCTION public.get_creator_session_stats(target_creator_id UUID)
RETURNS TABLE(
  sessions_hosted INTEGER,
  unique_guests INTEGER
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    -- Count completed sessions (live_ended_at IS NOT NULL means session actually ran and ended)
    (
      SELECT COUNT(*)::INTEGER 
      FROM public.events 
      WHERE creator_id = target_creator_id 
        AND live_ended_at IS NOT NULL
    ) as sessions_hosted,
    -- Count unique guests from live_viewers (all users who ever joined any session)
    (
      SELECT COUNT(DISTINCT lv.user_id)::INTEGER
      FROM public.live_viewers lv
      INNER JOIN public.events e ON e.id = lv.event_id
      WHERE e.creator_id = target_creator_id
    ) as unique_guests;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_creator_session_stats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_creator_session_stats(UUID) TO anon;
