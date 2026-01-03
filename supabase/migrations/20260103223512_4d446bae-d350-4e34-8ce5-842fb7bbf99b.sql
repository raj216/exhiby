-- Add category column to events table
ALTER TABLE public.events 
ADD COLUMN category text;

-- Add index for category filtering
CREATE INDEX idx_events_category ON public.events (category);