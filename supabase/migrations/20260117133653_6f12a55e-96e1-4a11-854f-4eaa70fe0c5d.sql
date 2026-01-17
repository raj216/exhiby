-- Add a new RLS policy to allow viewing scheduled events that haven't gone live yet
-- This handles the "ready to go live" state where scheduled_at has passed but is_live is still false

CREATE POLICY "Anyone can view scheduled or not-yet-started events"
ON public.events
FOR SELECT
USING (
  -- Event is scheduled for future OR scheduled time passed but not live yet and not ended
  (scheduled_at <= now() AND (is_live = false OR is_live IS NULL) AND live_ended_at IS NULL)
);