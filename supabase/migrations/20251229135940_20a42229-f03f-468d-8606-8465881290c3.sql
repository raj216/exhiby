-- Add room_url and live_ended_at columns to events table
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS room_url text;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS live_ended_at timestamp with time zone;

-- Create index for faster live event queries
CREATE INDEX IF NOT EXISTS idx_events_is_live ON public.events(is_live) WHERE is_live = true;