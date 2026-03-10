CREATE OR REPLACE FUNCTION public.get_event_room_url(event_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_room_url text;
  v_creator_id uuid;
  v_is_free boolean;
  v_has_valid_ticket boolean;
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

  -- For paid events, check if user has a CONFIRMED ticket (paid or free status)
  SELECT EXISTS (
    SELECT 1
    FROM public.tickets
    WHERE tickets.event_id = get_event_room_url.event_id
      AND tickets.user_id = auth.uid()
      AND tickets.payment_status IN ('paid', 'free')
  )
  INTO v_has_valid_ticket;

  IF v_has_valid_ticket THEN
    RETURN v_room_url;
  END IF;

  -- Unauthorized
  RETURN NULL;
END;
$$;