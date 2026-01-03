-- Allow anyone to view recently ended events (within 30 minutes)
CREATE POLICY "Anyone can view recently ended events"
ON public.events
FOR SELECT
USING (
  room_url IS NOT NULL 
  AND live_ended_at IS NOT NULL 
  AND live_ended_at > (now() - interval '30 minutes')
);