-- Create live_hand_raises table for persistent hand raise tracking
CREATE TABLE public.live_hand_raises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  cleared_at timestamp with time zone DEFAULT NULL
);

-- Create unique constraint to prevent duplicate active raises
CREATE UNIQUE INDEX idx_live_hand_raises_unique_active 
ON public.live_hand_raises (event_id, user_id) 
WHERE cleared_at IS NULL;

-- Index for efficient queries
CREATE INDEX idx_live_hand_raises_event_id ON public.live_hand_raises(event_id);
CREATE INDEX idx_live_hand_raises_user_id ON public.live_hand_raises(user_id);

-- Enable RLS
ALTER TABLE public.live_hand_raises ENABLE ROW LEVEL SECURITY;

-- Policy: Users can insert their own hand raises
CREATE POLICY "Users can raise their own hand"
ON public.live_hand_raises
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can view hand raises for events they're participating in
CREATE POLICY "Participants can view hand raises"
ON public.live_hand_raises
FOR SELECT
USING (
  -- Creator can see all hand raises for their events
  EXISTS (
    SELECT 1 FROM events e 
    WHERE e.id = live_hand_raises.event_id 
    AND e.creator_id = auth.uid()
  )
  OR
  -- Users can see their own hand raises
  auth.uid() = user_id
);

-- Policy: Creator can clear (update) hand raises for their events
CREATE POLICY "Creator can clear hand raises"
ON public.live_hand_raises
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM events e 
    WHERE e.id = live_hand_raises.event_id 
    AND e.creator_id = auth.uid()
  )
);

-- Policy: Users can delete their own hand raises (lower hand)
CREATE POLICY "Users can lower their own hand"
ON public.live_hand_raises
FOR DELETE
USING (auth.uid() = user_id);

-- Enable realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_hand_raises;