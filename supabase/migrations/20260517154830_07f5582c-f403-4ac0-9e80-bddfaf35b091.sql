-- 1) Tickets: revoke UPDATE privilege on protected columns from client roles.
-- Users may still UPDATE attended_at (the only intended writable column).
REVOKE UPDATE (payment_status, amount, currency, stripe_checkout_session_id, user_id, event_id, purchased_at)
  ON public.tickets FROM anon, authenticated;

-- 2) sent_emails: enforce one email per (event_id, user_id, email_type) for idempotency.
-- Use a partial-safe unique index; safe to re-run.
CREATE UNIQUE INDEX IF NOT EXISTS sent_emails_event_user_type_unique
  ON public.sent_emails (event_id, user_id, email_type);
