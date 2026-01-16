-- Enable FULL replica identity for real-time to work properly
ALTER TABLE public.notifications REPLICA IDENTITY FULL;