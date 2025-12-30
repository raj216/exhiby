-- Create recent_searches table for logged-in users
CREATE TABLE public.recent_searches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  query TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.recent_searches ENABLE ROW LEVEL SECURITY;

-- Users can view their own recent searches
CREATE POLICY "Users can view own recent searches"
  ON public.recent_searches
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own recent searches
CREATE POLICY "Users can insert own recent searches"
  ON public.recent_searches
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own recent searches
CREATE POLICY "Users can delete own recent searches"
  ON public.recent_searches
  FOR DELETE
  USING (auth.uid() = user_id);

-- Index for efficient lookup
CREATE INDEX idx_recent_searches_user_id ON public.recent_searches(user_id, created_at DESC);