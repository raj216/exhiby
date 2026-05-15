-- ─────────────────────────────────────────────────────────────────────────────
-- Notification triggers
-- Creates in-app notifications automatically for:
--   1. New follower  (follows INSERT)
--   2. New DM        (messages INSERT)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Follow notifications ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_on_follow()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_follower_name text;
BEGIN
  -- Look up the follower's display name
  SELECT name INTO v_follower_name
  FROM public.profiles
  WHERE user_id = NEW.follower_id;

  -- Insert the in-app notification for the person being followed
  INSERT INTO public.notifications (user_id, type, title, message, link, is_read)
  VALUES (
    NEW.following_id,
    'new_follower',
    COALESCE(v_follower_name, 'Someone') || ' started following you',
    NULL,
    '/profile/' || NEW.follower_id::text,
    false
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never let a notification error block the follow action
  RAISE WARNING 'notify_on_follow failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_new_follow ON public.follows;
CREATE TRIGGER on_new_follow
  AFTER INSERT ON public.follows
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_follow();


-- ── 2. DM notifications ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_on_new_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender_name  text;
  v_recipient_id uuid;
  v_preview      text;
BEGIN
  -- Get the sender's display name
  SELECT name INTO v_sender_name
  FROM public.profiles
  WHERE user_id = NEW.sender_id;

  -- Find the other participant in this conversation
  SELECT cp.user_id INTO v_recipient_id
  FROM public.conversation_participants cp
  WHERE cp.conversation_id = NEW.conversation_id
    AND cp.user_id <> NEW.sender_id
    AND cp.deleted_at IS NULL
  LIMIT 1;

  -- Nothing to do if no recipient found (shouldn't happen)
  IF v_recipient_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Trim message content to a short preview (max 80 chars)
  v_preview := LEFT(TRIM(NEW.content), 80);
  IF LENGTH(TRIM(NEW.content)) > 80 THEN
    v_preview := v_preview || '…';
  END IF;

  INSERT INTO public.notifications (user_id, type, title, message, link, is_read)
  VALUES (
    v_recipient_id,
    'new_message',
    COALESCE(v_sender_name, 'Someone') || ' sent you a message',
    v_preview,
    '/messages/' || NEW.conversation_id::text,
    false
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_on_new_message failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_new_message ON public.messages;
CREATE TRIGGER on_new_message
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_new_message();
