-- Create policy for admins to view all feedback (for founder dashboard)
CREATE POLICY "Admins can view all feedback"
ON public.session_feedback
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));