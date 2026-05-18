
-- 1. Drop the no-op restrictive policy on tickets and rely on column-level REVOKE + trigger
DROP POLICY IF EXISTS "tickets_block_protected_column_updates" ON public.tickets;

-- Ensure trigger guarding column immutability is attached
DROP TRIGGER IF EXISTS tickets_user_update_guard_trigger ON public.tickets;
CREATE TRIGGER tickets_user_update_guard_trigger
BEFORE UPDATE ON public.tickets
FOR EACH ROW
EXECUTE FUNCTION public.tickets_user_update_guard();

-- 2. Prevent duplicate concurrent payouts: unique partial index on pending rows per creator
CREATE UNIQUE INDEX IF NOT EXISTS creator_payouts_one_pending_per_creator
  ON public.creator_payouts (creator_id)
  WHERE status = 'pending';
