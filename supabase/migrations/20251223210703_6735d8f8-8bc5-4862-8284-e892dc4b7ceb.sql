-- Create events table for scheduled creator events
CREATE TABLE public.events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  creator_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  cover_url TEXT,
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  is_free BOOLEAN NOT NULL DEFAULT true,
  price DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Creators can view their own events
CREATE POLICY "Creators can view their own events"
ON public.events
FOR SELECT
USING (auth.uid() = creator_id);

-- Creators can insert their own events
CREATE POLICY "Creators can insert their own events"
ON public.events
FOR INSERT
WITH CHECK (auth.uid() = creator_id);

-- Creators can update their own events
CREATE POLICY "Creators can update their own events"
ON public.events
FOR UPDATE
USING (auth.uid() = creator_id);

-- Creators can delete their own events
CREATE POLICY "Creators can delete their own events"
ON public.events
FOR DELETE
USING (auth.uid() = creator_id);

-- Public can view all future events (for discovery)
CREATE POLICY "Public can view future events"
ON public.events
FOR SELECT
USING (scheduled_at > now());

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_events_updated_at
BEFORE UPDATE ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for event covers
INSERT INTO storage.buckets (id, name, public) VALUES ('event-covers', 'event-covers', true);

-- Storage policies for event covers
CREATE POLICY "Event covers are publicly accessible"
ON storage.objects
FOR SELECT
USING (bucket_id = 'event-covers');

CREATE POLICY "Users can upload their own event covers"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'event-covers' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own event covers"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'event-covers' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own event covers"
ON storage.objects
FOR DELETE
USING (bucket_id = 'event-covers' AND auth.uid()::text = (storage.foldername(name))[1]);