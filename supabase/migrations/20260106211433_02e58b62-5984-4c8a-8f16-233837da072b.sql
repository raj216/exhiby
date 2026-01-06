-- Create live_messages table for real-time chat
CREATE TABLE public.live_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  display_name text,
  role text NOT NULL DEFAULT 'viewer',
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  
  CONSTRAINT role_check CHECK (role IN ('creator', 'viewer')),
  CONSTRAINT message_length CHECK (char_length(message) <= 200)
);

-- Create indexes for performance
CREATE INDEX idx_live_messages_event_created ON public.live_messages(event_id, created_at);
CREATE INDEX idx_live_messages_user ON public.live_messages(user_id);

-- Enable Row Level Security
ALTER TABLE public.live_messages ENABLE ROW LEVEL SECURITY;

-- SELECT: Authenticated users can read messages
CREATE POLICY "Authenticated users can read messages"
ON public.live_messages
FOR SELECT
TO authenticated
USING (true);

-- INSERT: Authenticated users can insert their own messages
CREATE POLICY "Users can insert their own messages"
ON public.live_messages
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- No UPDATE or DELETE policies (messages cannot be edited or deleted)

-- Enable realtime for live_messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_messages;