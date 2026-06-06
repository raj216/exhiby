-- ─────────────────────────────────────────────────────────────────────────────
-- Publish creator_earnings to the realtime publication
-- ─────────────────────────────────────────────────────────────────────────────
-- Root cause of "tips/payments don't update on the creator dashboard":
-- useCreatorEarnings (src/hooks/useCreatorEarnings.ts) and the live-room tip
-- toast (src/pages/LiveRoom.tsx) both register postgres_changes handlers on
-- public.creator_earnings — but the table was never added to the
-- supabase_realtime publication. With the table unpublished, those INSERT/UPDATE
-- events are NEVER delivered, so the dashboard only refreshes on a manual reload
-- and the in-room "tip received" toast never appears.
--
-- ROW isolation is guaranteed: a creator only ever receives their OWN earning
-- rows, enforced by both (a) the table RLS SELECT policy "Creators can view
-- their own earnings" (auth.uid() = creator_id) and (b) the realtime.messages
-- topic policy which already authorises the `creator-earnings-<uid>` topic
-- (added in 20260516155910). This publication line is the one missing piece —
-- the channel + authorization were already wired up; the table was just never
-- published, so the events were silently never delivered.
--
-- COLUMN exposure note: the sensitive columns on this table
-- (user_id/stripe_payment_intent_id/stripe_event_id/stripe_checkout_session_id)
-- were REVOKEd from authenticated in 20260516155910. The app's design relies on
-- Realtime honouring those column privileges in the change payload — consistent
-- with that migration intentionally pairing the REVOKEs with this channel. The
-- client code does NOT depend on those columns regardless: useCreatorEarnings
-- ignores the payload (it only invalidates its query) and LiveRoom's tip toast
-- reads only amount_gross + ticket_id (both non-sensitive). If a future audit
-- shows Realtime does send REVOKEd columns, switch this to a trigger-driven
-- Broadcast with an explicit safe payload rather than publishing the base table.
--
-- Default replica identity (primary key) is sufficient: the dashboard filters on
-- creator_id, present in the new tuple for INSERT and UPDATE. We intentionally do
-- NOT set REPLICA IDENTITY FULL, to avoid broadcasting old-tuple data on updates.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'creator_earnings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.creator_earnings;
  END IF;
END $$;
