-- Update get_user_conversations to only return conversations with at least 1 message
CREATE OR REPLACE FUNCTION public.get_user_conversations()
RETURNS TABLE(
  conversation_id uuid,
  other_user_id uuid,
  other_user_name text,
  other_user_handle text,
  other_user_avatar text,
  other_user_verified boolean,
  last_message_content text,
  last_message_at timestamp with time zone,
  last_message_sender_id uuid,
  unread_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH user_convs AS (
    SELECT cp.conversation_id
    FROM public.conversation_participants cp
    WHERE cp.user_id = auth.uid()
  ),
  -- Only include conversations that have at least 1 message
  convs_with_messages AS (
    SELECT DISTINCT m.conversation_id
    FROM public.messages m
    WHERE m.conversation_id IN (SELECT conversation_id FROM user_convs)
  ),
  last_messages AS (
    SELECT DISTINCT ON (m.conversation_id)
      m.conversation_id,
      m.content,
      m.created_at,
      m.sender_id
    FROM public.messages m
    WHERE m.conversation_id IN (SELECT conversation_id FROM convs_with_messages)
    ORDER BY m.conversation_id, m.created_at DESC
  ),
  unread_counts AS (
    SELECT 
      m.conversation_id,
      COUNT(*) as unread
    FROM public.messages m
    WHERE m.conversation_id IN (SELECT conversation_id FROM convs_with_messages)
      AND m.sender_id != auth.uid()
      AND m.read_at IS NULL
    GROUP BY m.conversation_id
  )
  SELECT 
    cwm.conversation_id,
    cp.user_id as other_user_id,
    p.name as other_user_name,
    p.handle as other_user_handle,
    p.avatar_url as other_user_avatar,
    p.is_verified as other_user_verified,
    lm.content as last_message_content,
    lm.created_at as last_message_at,
    lm.sender_id as last_message_sender_id,
    COALESCE(urc.unread, 0) as unread_count
  FROM convs_with_messages cwm
  INNER JOIN public.conversation_participants cp 
    ON cp.conversation_id = cwm.conversation_id 
    AND cp.user_id != auth.uid()
  LEFT JOIN public.profiles p ON p.user_id = cp.user_id
  LEFT JOIN last_messages lm ON lm.conversation_id = cwm.conversation_id
  LEFT JOIN unread_counts urc ON urc.conversation_id = cwm.conversation_id
  ORDER BY lm.created_at DESC;
$function$;