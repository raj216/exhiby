-- Create a dedicated table to store sensitive room URLs (separate from publicly-readable event metadata)
CREATE TABLE IF NOT EXISTS public.event_rooms (
  event_id uuid PRIMARY KEY,
  room_url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT event_rooms_event_id_fkey
    FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE
);

ALTER TABLE public.event_rooms ENABLE ROW LEVEL SECURITY;

-- Only the event creator can manage/view the room URL record directly.
DROP POLICY IF EXISTS "Creators can view their event room urls" ON public.event_rooms;
CREATE POLICY "Creators can view their event room urls"
ON public.event_rooms
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = event_rooms.event_id
      AND e.creator_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Creators can insert their event room urls" ON public.event_rooms;
CREATE POLICY "Creators can insert their event room urls"
ON public.event_rooms
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = event_rooms.event_id
      AND e.creator_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Creators can update their event room urls" ON public.event_rooms;
CREATE POLICY "Creators can update their event room urls"
ON public.event_rooms
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = event_rooms.event_id
      AND e.creator_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Creators can delete their event room urls" ON public.event_rooms;
CREATE POLICY "Creators can delete their event room urls"
ON public.event_rooms
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = event_rooms.event_id
      AND e.creator_id = auth.uid()
  )
);

-- Ensure timestamp updates
DROP TRIGGER IF EXISTS update_event_rooms_updated_at ON public.event_rooms;
CREATE TRIGGER update_event_rooms_updated_at
BEFORE UPDATE ON public.event_rooms
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Migrate existing data from events.room_url -> event_rooms
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'events'
      AND column_name = 'room_url'
  ) THEN
    INSERT INTO public.event_rooms (event_id, room_url)
    SELECT id, room_url
    FROM public.events
    WHERE room_url IS NOT NULL
    ON CONFLICT (event_id)
    DO UPDATE SET room_url = EXCLUDED.room_url, updated_at = now();
  END IF;
END $$;

-- Update get_event_room_url() to read from event_rooms (not events)
CREATE OR REPLACE FUNCTION public.get_event_room_url(event_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room_url text;
  v_creator_id uuid;
  v_is_free boolean;
  v_has_ticket boolean;
BEGIN
  -- Get event details
  SELECT creator_id, is_free
  INTO v_creator_id, v_is_free
  FROM public.events
  WHERE id = event_id;

  -- Event not found
  IF v_creator_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Fetch room URL from the protected table
  SELECT room_url
  INTO v_room_url
  FROM public.event_rooms
  WHERE event_rooms.event_id = get_event_room_url.event_id;

  IF v_room_url IS NULL THEN
    RETURN NULL;
  END IF;

  -- Creator always has access
  IF auth.uid() = v_creator_id THEN
    RETURN v_room_url;
  END IF;

  -- For free events, any authenticated user has access
  IF v_is_free = true AND auth.uid() IS NOT NULL THEN
    RETURN v_room_url;
  END IF;

  -- For paid events, check if user has a ticket
  SELECT EXISTS (
    SELECT 1
    FROM public.tickets
    WHERE tickets.event_id = get_event_room_url.event_id
      AND tickets.user_id = auth.uid()
  )
  INTO v_has_ticket;

  IF v_has_ticket THEN
    RETURN v_room_url;
  END IF;

  -- Unauthorized
  RETURN NULL;
END;
$$;

-- Replace RLS policies on events that referenced events.room_url
DROP POLICY IF EXISTS "Anyone can view live events" ON public.events;
CREATE POLICY "Anyone can view live events"
ON public.events
FOR SELECT
USING (
  (is_live = true)
  AND (live_ended_at IS NULL)
  AND EXISTS (
    SELECT 1 FROM public.event_rooms er
    WHERE er.event_id = events.id
  )
);

DROP POLICY IF EXISTS "Anyone can view recently ended events" ON public.events;
CREATE POLICY "Anyone can view recently ended events"
ON public.events
FOR SELECT
USING (
  (live_ended_at IS NOT NULL)
  AND (live_ended_at > (now() - interval '30 minutes'))
  AND EXISTS (
    SELECT 1 FROM public.event_rooms er
    WHERE er.event_id = events.id
  )
);

-- Update live_materials SELECT policy that referenced e.room_url
DROP POLICY IF EXISTS "Materials visible for accessible events" ON public.live_materials;
CREATE POLICY "Materials visible for accessible events"
ON public.live_materials
FOR SELECT
USING (
  (
    EXISTS (
      SELECT 1
      FROM public.events e
      WHERE e.id = live_materials.event_id
        AND e.creator_id = auth.uid()
    )
  )
  OR
  (
    EXISTS (
      SELECT 1
      FROM public.events e
      WHERE e.id = live_materials.event_id
        AND (
          (
            (e.is_live = true)
            AND (e.live_ended_at IS NULL)
            AND EXISTS (
              SELECT 1 FROM public.event_rooms er
              WHERE er.event_id = e.id
            )
          )
          OR (e.scheduled_at > now())
          OR (
            (e.live_ended_at IS NOT NULL)
            AND (e.live_ended_at > (now() - interval '30 minutes'))
          )
        )
    )
  )
);

-- Drop the sensitive column from events (room_url no longer stored in publicly-readable table)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'events'
      AND column_name = 'room_url'
  ) THEN
    ALTER TABLE public.events DROP COLUMN room_url;
  END IF;
END $$;

-- Ensure events_public is explicitly read-only for anon/authenticated (prevents DML via updatable views)
REVOKE ALL ON public.events_public FROM anon, authenticated;
GRANT SELECT ON public.events_public TO anon, authenticated;
