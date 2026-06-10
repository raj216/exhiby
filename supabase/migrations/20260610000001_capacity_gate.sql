-- ─────────────────────────────────────────────────────────────────────────────
-- Respect creator-set capacity in can_viewer_join_session
-- ─────────────────────────────────────────────────────────────────────────────
-- Prior version only enforced plan limits (50 for free, unlimited for pro/plus)
-- and completely ignored the events.capacity value that the creator set when
-- scheduling the studio. Now:
--   • If events.capacity IS NOT NULL → that is the binding seat limit.
--   • Free plan hard cap (50) still applies as a ceiling: effective max is
--     min(events.capacity, 50) so free creators can't accidentally set 200.
--   • Pro/Plus with capacity set → respect the creator's limit.
--   • Pro/Plus with capacity NULL → unlimited (existing behaviour).
--   • Free plan with capacity NULL → 50 (existing behaviour).

CREATE OR REPLACE FUNCTION public.can_viewer_join_session(p_event_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_creator_id  uuid;
  v_plan        text;
  v_capacity    int;   -- NULL = creator did not set a cap (pro unlimited)
  v_max         int;
  v_current     int;
BEGIN
  -- 1. Get creator and the creator-set seat limit in one shot
  SELECT creator_id, capacity
    INTO v_creator_id, v_capacity
  FROM public.events
  WHERE id = p_event_id;

  IF v_creator_id IS NULL THEN
    RETURN jsonb_build_object('can_join', true, 'reason', 'event_not_found');
  END IF;

  -- 1b. The creator's OWN devices never consume an audience seat and are never
  -- gated. This matters for companion mode (phone-as-camera + laptop-control):
  -- the second device joins as a "viewer" purely for chat RLS, and must not be
  -- blocked when the audience is full — otherwise the host loses their own chat.
  IF auth.uid() = v_creator_id THEN
    RETURN jsonb_build_object('can_join', true, 'reason', 'creator_bypass');
  END IF;

  -- 2. Get the creator's plan
  SELECT COALESCE(plan, 'free')
    INTO v_plan
  FROM public.profiles
  WHERE user_id = v_creator_id;

  -- 3. Determine effective max viewers
  IF v_plan IN ('pro', 'plus') THEN
    IF v_capacity IS NULL THEN
      -- Pro/Plus, no creator cap → unlimited
      RETURN jsonb_build_object('can_join', true, 'max_viewers', null, 'current_viewers', null);
    END IF;
    -- Pro/Plus with explicit creator cap
    v_max := v_capacity;
  ELSE
    -- Free plan: creator cap or 50, whichever is smaller
    IF v_capacity IS NOT NULL THEN
      v_max := LEAST(v_capacity, 50);
    ELSE
      v_max := 50;
    END IF;
  END IF;

  -- Guard against a non-positive cap locking everyone out (bad/legacy data).
  -- The UI validates capacity >= 1, but the column has no CHECK constraint.
  IF v_max IS NOT NULL AND v_max < 1 THEN
    v_max := 1;
  END IF;

  -- 4. Count active AUDIENCE viewers (heartbeat within 30 seconds). The creator's
  -- own devices are excluded so "N seats" always means N audience members, not
  -- N-minus-the-host's-companion.
  SELECT COUNT(*)
    INTO v_current
  FROM public.live_viewers
  WHERE event_id = p_event_id
    AND user_id <> v_creator_id
    AND last_seen > (now() - interval '30 seconds');

  IF v_current >= v_max THEN
    RETURN jsonb_build_object(
      'can_join',        false,
      'reason',          'session_full',
      'max_viewers',     v_max,
      'current_viewers', v_current
    );
  END IF;

  RETURN jsonb_build_object(
    'can_join',        true,
    'max_viewers',     v_max,
    'current_viewers', v_current
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_viewer_join_session(uuid) TO authenticated;
