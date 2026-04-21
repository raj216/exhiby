ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS pinned_message_id uuid
  REFERENCES public.live_messages(id)
  ON DELETE SET NULL;