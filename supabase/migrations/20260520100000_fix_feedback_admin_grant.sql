-- Fix: get_all_feedback_admin was revoked from all roles (anon, authenticated, public)
-- in migration 20260430220106 and never re-granted. Every call from the admin
-- feedback page has been silently returning a permissions error.
--
-- Also updates the function to include the four new columns added in
-- 20260517100000_session_feedback_new_columns.sql which the original
-- function predates.

DROP FUNCTION IF EXISTS public.get_all_feedback_admin();

CREATE OR REPLACE FUNCTION public.get_all_feedback_admin()
RETURNS TABLE(
  id                  uuid,
  event_id            uuid,
  creator_id          uuid,
  audience_user_id    uuid,
  rating              integer,
  public_tags         text[],
  private_feedback_text text,
  improvement_category  text,
  left_early          boolean,
  left_early_reason   text,
  value_gained        text,
  pacing              text,
  creator_engagement  text,
  would_return        text,
  created_at          timestamp with time zone
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

  RETURN QUERY
  SELECT
    sf.id,
    sf.event_id,
    sf.creator_id,
    sf.audience_user_id,
    sf.rating,
    sf.public_tags,
    sf.private_feedback_text,
    sf.improvement_category,
    sf.left_early,
    sf.left_early_reason,
    sf.value_gained,
    sf.pacing,
    sf.creator_engagement,
    sf.would_return,
    sf.created_at
  FROM public.session_feedback sf
  ORDER BY sf.created_at DESC;
END;
$$;

-- The function validates admin status server-side before returning any data,
-- so granting to authenticated is safe. Non-admins receive an exception.
GRANT EXECUTE ON FUNCTION public.get_all_feedback_admin() TO authenticated;
