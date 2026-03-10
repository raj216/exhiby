DROP POLICY "Authenticated users can add participants" ON public.conversation_participants;

CREATE POLICY "Users can only add themselves as participants"
ON public.conversation_participants FOR INSERT
WITH CHECK (auth.uid() = user_id);