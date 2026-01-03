-- Enable full replica identity for complete row data in realtime
ALTER TABLE public.live_materials REPLICA IDENTITY FULL;

-- Add to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_materials;