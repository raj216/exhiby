-- Add RLS policy to allow conversation participants to mark received messages as read
-- This allows updating read_at on messages where the current user is the recipient (not the sender)

CREATE POLICY "Participants can mark received messages as read"
ON public.messages
FOR UPDATE
USING (
  -- User must be a participant in the conversation
  is_conversation_participant(conversation_id, auth.uid())
  -- And they must NOT be the sender (can only mark messages they received)
  AND sender_id != auth.uid()
)
WITH CHECK (
  -- Same conditions for the new row state
  is_conversation_participant(conversation_id, auth.uid())
  AND sender_id != auth.uid()
);