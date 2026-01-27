-- Create a SECURITY DEFINER function for admin-only feedback access
-- This function validates that the caller is an admin before returning any data
CREATE OR REPLACE FUNCTION public.get_all_feedback_admin()
RETURNS TABLE(
  id uuid,
  event_id uuid,
  creator_id uuid,
  audience_user_id uuid,
  rating integer,
  public_tags text[],
  private_feedback_text text,
  improvement_category text,
  left_early boolean,
  left_early_reason text,
  created_at timestamp with time zone
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- CRITICAL: Server-side admin validation - cannot be bypassed
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;
  
  -- Return all feedback only if admin check passed
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
    sf.created_at
  FROM public.session_feedback sf
  ORDER BY sf.created_at DESC;
END;
$$;