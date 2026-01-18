-- Add unique constraint on (event_id, user_id) to prevent duplicate tickets
-- This ensures a user can only have one ticket per event
ALTER TABLE public.tickets 
ADD CONSTRAINT tickets_event_user_unique UNIQUE (event_id, user_id);