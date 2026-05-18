-- ─────────────────────────────────────────────────────────────────────────────
-- Idempotency guard for creator-approval notifications
--
-- At most ONE notification of type 'creator_approved' per user. This makes the
-- notification insert in the notify-creator-approved edge function an atomic,
-- race-safe dedup point (a concurrent double-invoke yields a 23505 on the
-- second insert instead of a duplicate bell + duplicate email).
--
-- PARTIAL index: it only constrains rows where type = 'creator_approved', so
-- it has zero effect on every other notification type (new_follower,
-- new_message, etc., which are intentionally many-per-user).
--
-- Idempotent (IF NOT EXISTS) — safe to re-run, and safe to apply manually in
-- the SQL editor if the migration lags behind deploy.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE UNIQUE INDEX IF NOT EXISTS notifications_creator_approved_unique
  ON public.notifications (user_id)
  WHERE type = 'creator_approved';
