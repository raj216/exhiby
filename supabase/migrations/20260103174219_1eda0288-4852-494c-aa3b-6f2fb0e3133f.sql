-- Create materials table for storing materials per event
CREATE TABLE public.live_materials (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name text NOT NULL,
  brand text,
  spec text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.live_materials ENABLE ROW LEVEL SECURITY;

-- Anyone can view materials (for live room viewers)
CREATE POLICY "Anyone can view materials"
ON public.live_materials
FOR SELECT
USING (true);

-- Only event creator can insert materials
CREATE POLICY "Event creator can insert materials"
ON public.live_materials
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.events
    WHERE events.id = live_materials.event_id
    AND events.creator_id = auth.uid()
  )
);

-- Only event creator can update materials
CREATE POLICY "Event creator can update materials"
ON public.live_materials
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.events
    WHERE events.id = live_materials.event_id
    AND events.creator_id = auth.uid()
  )
);

-- Only event creator can delete materials
CREATE POLICY "Event creator can delete materials"
ON public.live_materials
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.events
    WHERE events.id = live_materials.event_id
    AND events.creator_id = auth.uid()
  )
);

-- Trigger for updated_at
CREATE TRIGGER update_live_materials_updated_at
  BEFORE UPDATE ON public.live_materials
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();