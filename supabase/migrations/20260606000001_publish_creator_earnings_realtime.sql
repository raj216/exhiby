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
-- Row visibility is still enforced by the existing RLS SELECT policy
-- ("Creators can view their own earnings" → auth.uid() = creator_id), and the
-- column-level REVOKEs on stripe identifiers / buyer user_id continue to apply,
-- so a creator only ever receives their own earning rows.
--
-- Default replica identity (primary key) is sufficient here: the dashboard
-- filters on creator_id, which is present in the new tuple for INSERT and UPDATE
-- events. We intentionally do NOT set REPLICA IDENTITY FULL to avoid broadcasting
-- old-tuple data on updates.
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
