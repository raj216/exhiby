-- Harden public read access to events (reduce scraping of creator/pricing/viewer metrics)
DO $$
BEGIN
  -- Drop broad public SELECT policies
  DROP POLICY IF EXISTS "Anyone can view future scheduled events" ON public.events;
  DROP POLICY IF EXISTS "Anyone can view live events" ON public.events;
  DROP POLICY IF EXISTS "Anyone can view recently ended events" ON public.events;
  DROP POLICY IF EXISTS "Anyone can view scheduled or not-yet-started events" ON public.events;

  -- Recreate them scoped to authenticated users only
  CREATE POLICY "Authenticated users can view future scheduled events"
    ON public.events
    FOR SELECT
    TO authenticated
    USING (scheduled_at > now());

  CREATE POLICY "Authenticated users can view live events"
    ON public.events
    FOR SELECT
    TO authenticated
    USING ((is_live = true) AND (live_ended_at IS NULL));

  CREATE POLICY "Authenticated users can view recently ended events"
    ON public.events
    FOR SELECT
    TO authenticated
    USING ((live_ended_at IS NOT NULL) AND (live_ended_at > (now() - interval '30 minutes')));

  CREATE POLICY "Authenticated users can view scheduled or not-yet-started events"
    ON public.events
    FOR SELECT
    TO authenticated
    USING ((scheduled_at <= now()) AND ((is_live = false) OR (is_live IS NULL)) AND (live_ended_at IS NULL));
END$$;

-- Prevent client-side ticket creation (must go through backend validation)
DROP POLICY IF EXISTS "Users can purchase tickets" ON public.tickets;

-- Enforce one ticket per user per event for integrity
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tickets_event_user_unique'
      AND conrelid = 'public.tickets'::regclass
  ) THEN
    ALTER TABLE public.tickets
      ADD CONSTRAINT tickets_event_user_unique UNIQUE (event_id, user_id);
  END IF;
END$$;