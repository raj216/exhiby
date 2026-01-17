-- Create session_feedback table for post-session ratings and feedback
CREATE TABLE public.session_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL,
  audience_user_id UUID NOT NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  public_tags TEXT[] DEFAULT '{}',
  private_feedback_text TEXT,
  improvement_category TEXT,
  left_early BOOLEAN DEFAULT false,
  left_early_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create unique constraint to prevent duplicate feedback per user per session
CREATE UNIQUE INDEX session_feedback_unique_per_user_session 
ON public.session_feedback(event_id, audience_user_id);

-- Enable Row Level Security
ALTER TABLE public.session_feedback ENABLE ROW LEVEL SECURITY;

-- Users can insert their own feedback (one per session)
CREATE POLICY "Users can submit their own feedback"
ON public.session_feedback
FOR INSERT
WITH CHECK (auth.uid() = audience_user_id);

-- Users can view their own feedback
CREATE POLICY "Users can view their own feedback"
ON public.session_feedback
FOR SELECT
USING (auth.uid() = audience_user_id);

-- Creators can view public feedback (rating + tags only) for their events
CREATE POLICY "Creators can view feedback for their events"
ON public.session_feedback
FOR SELECT
USING (auth.uid() = creator_id);

-- Admins can view all feedback (including private) via has_role function
-- Note: We need to add 'admin' to the app_role enum first

-- Create function to get creator average rating
CREATE OR REPLACE FUNCTION public.get_creator_rating_stats(target_creator_id UUID)
RETURNS TABLE(
  average_rating NUMERIC,
  total_ratings INTEGER,
  total_guests INTEGER
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    COALESCE(ROUND(AVG(rating)::numeric, 1), 0) as average_rating,
    COUNT(CASE WHEN rating IS NOT NULL THEN 1 END)::INTEGER as total_ratings,
    COUNT(DISTINCT audience_user_id)::INTEGER as total_guests
  FROM public.session_feedback
  WHERE creator_id = target_creator_id;
$$;

-- Create index for faster queries
CREATE INDEX idx_session_feedback_creator_id ON public.session_feedback(creator_id);
CREATE INDEX idx_session_feedback_event_id ON public.session_feedback(event_id);

-- Enable realtime for session_feedback updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.session_feedback;