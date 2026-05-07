-- ─────────────────────────────────────────────────────────────────────────────
-- can_viewer_join_session(p_event_id)
-- ─────────────────────────────────────────────────────────────────────────────
-- Returns whether the calling user can join a live session as a viewer,
-- taking the creator's plan into account.
--
-- Free plan:  max 50 concurrent viewers
-- Pro / Plus: unlimited
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.can_viewer_join_session(p_event_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_creator_id  uuid;
  v_plan        text;
  v_max         int;
  v_current     int;
BEGIN
  -- 1. Get the creator of this event
  SELECT creator_id INTO v_creator_id
  FROM public.events
  WHERE id = p_event_id;

  IF v_creator_id IS NULL THEN
    RETURN jsonb_build_object('can_join', true, 'reason', 'event_not_found');
  END IF;

  -- 2. Get the creator's plan
  SELECT COALESCE(plan, 'free') INTO v_plan
  FROM public.profiles
  WHERE user_id = v_creator_id;

  -- 3. Pro / Plus — always allow
  IF v_plan IN ('pro', 'plus') THEN
    RETURN jsonb_build_object('can_join', true, 'max_viewers', null, 'current_viewers', null);
  END IF;

  -- 4. Free plan — check 50-viewer cap
  v_max := 50;

  SELECT COUNT(*) INTO v_current
  FROM public.live_viewers
  WHERE event_id = p_event_id
    AND last_seen > (now() - interval '30 seconds');

  IF v_current >= v_max THEN
    RETURN jsonb_build_object(
      'can_join', false,
      'reason', 'session_full',
      'max_viewers', v_max,
      'current_viewers', v_current
    );
  END IF;

  RETURN jsonb_build_object(
    'can_join', true,
    'max_viewers', v_max,
    'current_viewers', v_current
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_viewer_join_session(uuid) TO authenticated;
