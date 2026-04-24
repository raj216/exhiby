-- Restrict create_notification RPC to service_role only.
-- Edge functions (notify-followers, etc.) call this with the service role key
-- via supabase.rpc(), so service_role retains EXECUTE. Regular users (anon /
-- authenticated) can no longer push arbitrary notifications to other inboxes.

REVOKE EXECUTE ON FUNCTION public.create_notification(uuid, text, text, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_notification(uuid, text, text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_notification(uuid, text, text, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.create_notification(uuid, text, text, text, text) TO service_role;

-- Also harden the function body with an explicit caller check as a defense-in-depth
-- measure, so even if EXECUTE is re-granted accidentally, only service_role / postgres
-- (no auth.uid()) can use it.
CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_message text DEFAULT NULL::text,
  p_link text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_id uuid;
BEGIN
  -- Only allow trusted server-side callers (service_role / postgres). End users
  -- always have a non-null auth.uid(); service_role JWTs do not set auth.uid().
  IF auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Unauthorized: create_notification can only be called by trusted server-side roles';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id is required';
  END IF;

  IF p_type IS NULL OR p_type = '' THEN
    RAISE EXCEPTION 'type is required';
  END IF;

  IF p_title IS NULL OR p_title = '' THEN
    RAISE EXCEPTION 'title is required';
  END IF;

  INSERT INTO public.notifications (user_id, type, title, message, link)
  VALUES (p_user_id, p_type, p_title, p_message, p_link)
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$function$;

-- Re-apply grants (CREATE OR REPLACE preserves grants, but be explicit)
REVOKE EXECUTE ON FUNCTION public.create_notification(uuid, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_notification(uuid, text, text, text, text) TO service_role;