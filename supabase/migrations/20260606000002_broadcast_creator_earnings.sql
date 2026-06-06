-- ─────────────────────────────────────────────────────────────────────────────
-- Live creator earnings via Realtime Broadcast (sanitized payload)
-- ─────────────────────────────────────────────────────────────────────────────
-- Root cause of "tips/payments don't update on the creator dashboard":
-- useCreatorEarnings and LiveRoom's tip toast subscribed to changes on
-- public.creator_earnings, but the table was never wired up to deliver realtime
-- events, so those handlers never fired — earnings only refreshed on a manual
-- reload and the in-room "tip received" toast never appeared.
--
-- We deliberately DO NOT publish creator_earnings to the supabase_realtime
-- postgres_changes publication: that table has column-level REVOKEs hiding the
-- buyer's user_id and the Stripe identifiers, and publishing the base table
-- would put the full WAL row (including those columns) on the wire. Instead, a
-- trigger broadcasts an EXPLICIT, sanitized payload — only non-sensitive fields
-- (id, creator_id, event_id, amount_gross, ticket_id, status, created_at) — to
-- the per-creator topic `creator-earnings-<creator_id>`.
--
-- Topic access is already gated by the realtime.messages RLS policy added in
-- 20260516155910 (it authorises `creator-earnings-<auth.uid()>`), so a creator
-- only ever receives broadcasts for their OWN earnings, and the sensitive
-- columns are never transmitted at all.

CREATE OR REPLACE FUNCTION public.broadcast_creator_earning()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- A broadcast failure must NEVER roll back the financial write.
  BEGIN
    PERFORM realtime.send(
      jsonb_build_object(
        'id',           NEW.id,
        'creator_id',   NEW.creator_id,
        'event_id',     NEW.event_id,
        'amount_gross', NEW.amount_gross,  -- cents
        'ticket_id',    NEW.ticket_id,     -- null = tip, non-null = ticket sale
        'status',       NEW.status,
        'created_at',   NEW.created_at
      ),
      'earning',                                       -- event name
      'creator-earnings-' || NEW.creator_id::text,     -- topic (per creator)
      true                                             -- private channel
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'broadcast_creator_earning failed for %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_broadcast_creator_earning ON public.creator_earnings;
CREATE TRIGGER trg_broadcast_creator_earning
AFTER INSERT OR UPDATE ON public.creator_earnings
FOR EACH ROW
EXECUTE FUNCTION public.broadcast_creator_earning();
