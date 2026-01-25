-- Fix: Creators should only see public feedback fields, not private ones
-- The current policy allows creators to SELECT * which exposes private_feedback_text, left_early_reason, and improvement_category

-- Step 1: Drop the insecure creator policy that grants full read access
DROP POLICY IF EXISTS "Creators can view feedback for their events" ON public.session_feedback;

-- Step 2: Create a secure RPC that returns only public feedback fields to creators
CREATE OR REPLACE FUNCTION public.get_creator_feedback(target_creator_id uuid)
RETURNS TABLE(
  id uuid,
  event_id uuid,
  rating integer,
  public_tags text[],
  created_at timestamp with time zone
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    sf.id,
    sf.event_id,
    sf.rating,
    sf.public_tags,
    sf.created_at
  FROM public.session_feedback sf
  WHERE sf.creator_id = target_creator_id
    AND auth.uid() = target_creator_id  -- Only the creator can call this for themselves
  ORDER BY sf.created_at DESC;
$$;

-- Step 3: Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_creator_feedback(uuid) TO authenticated;

-- Note: The "Admins can view all feedback" and "Users can view their own feedback" policies remain unchanged
-- Admins retain full access via: has_role(auth.uid(), 'admin')
-- Users can see their own submissions via: auth.uid() = audience_user_id