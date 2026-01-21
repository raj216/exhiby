-- Add FK cascades so deleting an event cannot leave orphan rows behind
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'saved_sessions_event_id_fkey'
  ) THEN
    ALTER TABLE public.saved_sessions
      ADD CONSTRAINT saved_sessions_event_id_fkey
      FOREIGN KEY (event_id)
      REFERENCES public.events(id)
      ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'event_rooms_event_id_fkey'
  ) THEN
    ALTER TABLE public.event_rooms
      ADD CONSTRAINT event_rooms_event_id_fkey
      FOREIGN KEY (event_id)
      REFERENCES public.events(id)
      ON DELETE CASCADE;
  END IF;
END $$;

-- Helpful indexes for joins/lookups
CREATE INDEX IF NOT EXISTS idx_saved_sessions_event_id ON public.saved_sessions(event_id);
CREATE INDEX IF NOT EXISTS idx_event_rooms_event_id ON public.event_rooms(event_id);
