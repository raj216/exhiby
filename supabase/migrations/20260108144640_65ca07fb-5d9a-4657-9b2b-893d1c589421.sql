-- Create tickets table to track purchased tickets and session attendance
CREATE TABLE public.tickets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  purchased_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  attended_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add unique constraint to prevent duplicate tickets
ALTER TABLE public.tickets ADD CONSTRAINT tickets_user_event_unique UNIQUE (user_id, event_id);

-- Enable Row Level Security
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

-- Users can view their own tickets
CREATE POLICY "Users can view their own tickets"
ON public.tickets
FOR SELECT
USING (auth.uid() = user_id);

-- Users can purchase tickets (insert)
CREATE POLICY "Users can purchase tickets"
ON public.tickets
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own tickets (e.g., mark as attended)
CREATE POLICY "Users can update their own tickets"
ON public.tickets
FOR UPDATE
USING (auth.uid() = user_id);

-- Event creators can view tickets for their events (for analytics)
CREATE POLICY "Creators can view tickets for their events"
ON public.tickets
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.events
  WHERE events.id = tickets.event_id
  AND events.creator_id = auth.uid()
));

-- Create index for faster queries
CREATE INDEX idx_tickets_user_id ON public.tickets(user_id);
CREATE INDEX idx_tickets_event_id ON public.tickets(event_id);