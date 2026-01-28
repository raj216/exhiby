-- Remove direct admin SELECT access to session_feedback table
-- This forces all admin access through the get_all_feedback_admin() RPC
-- which has proper server-side validation and controlled data access

DROP POLICY IF EXISTS "Admins can view all feedback" ON public.session_feedback;