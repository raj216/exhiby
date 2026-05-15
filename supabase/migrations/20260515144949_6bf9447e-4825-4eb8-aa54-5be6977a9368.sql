
-- 1. Add stripe_customer_id column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS stripe_customer_id text;

-- 2. Attach tickets_user_update_guard trigger to enforce immutable payment fields
DROP TRIGGER IF EXISTS tickets_user_update_guard_trg ON public.tickets;
CREATE TRIGGER tickets_user_update_guard_trg
BEFORE UPDATE ON public.tickets
FOR EACH ROW
EXECUTE FUNCTION public.tickets_user_update_guard();

-- 3. Restrict events INSERT to users with creator role
DROP POLICY IF EXISTS "Creators can insert their own events" ON public.events;
CREATE POLICY "Creators can insert their own events"
ON public.events
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = creator_id
  AND public.has_role(auth.uid(), 'creator'::public.app_role)
);

-- 4. Restrict live_hand_raises INSERT to active viewers (or the event creator)
DROP POLICY IF EXISTS "Users can raise their own hand" ON public.live_hand_raises;
CREATE POLICY "Users can raise their own hand"
ON public.live_hand_raises
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = live_hand_raises.event_id
        AND e.creator_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.live_viewers lv
      WHERE lv.event_id = live_hand_raises.event_id
        AND lv.user_id = auth.uid()
        AND lv.last_seen > (now() - interval '30 seconds')
    )
  )
);

-- 5. Allow users to delete their own conversation_participants record (leave conversations)
CREATE POLICY "Users can leave conversations"
ON public.conversation_participants
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);
