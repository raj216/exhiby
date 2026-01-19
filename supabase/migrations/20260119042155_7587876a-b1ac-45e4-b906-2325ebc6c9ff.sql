-- Create saved_sessions table for audience session tracking
CREATE TABLE public.saved_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL,
  reminder_enabled boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  -- Prevent duplicate saves
  UNIQUE(user_id, event_id)
);

-- Enable RLS
ALTER TABLE public.saved_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own saved sessions"
  ON public.saved_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can save sessions"
  ON public.saved_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own saved sessions"
  ON public.saved_sessions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can remove their own saved sessions"
  ON public.saved_sessions FOR DELETE
  USING (auth.uid() = user_id);

-- Index for efficient queries
CREATE INDEX idx_saved_sessions_user_id ON public.saved_sessions(user_id);
CREATE INDEX idx_saved_sessions_event_id ON public.saved_sessions(event_id);
CREATE INDEX idx_saved_sessions_creator_id ON public.saved_sessions(creator_id);

-- Add trigger for updated_at
CREATE TRIGGER update_saved_sessions_updated_at
  BEFORE UPDATE ON public.saved_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for saved_sessions (for live updates)
ALTER PUBLICATION supabase_realtime ADD TABLE public.saved_sessions;