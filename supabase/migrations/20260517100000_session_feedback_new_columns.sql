-- ─────────────────────────────────────────────────────────────────────────────
-- Add new feedback columns to session_feedback
-- These power creator coaching AI and session quality signals.
-- All nullable — existing rows are unaffected.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.session_feedback
  ADD COLUMN IF NOT EXISTS value_gained        text CHECK (value_gained IN ('yes', 'somewhat', 'no')),
  ADD COLUMN IF NOT EXISTS pacing              text CHECK (pacing IN ('too_fast', 'good', 'too_slow')),
  ADD COLUMN IF NOT EXISTS creator_engagement  text CHECK (creator_engagement IN ('very_interactive', 'somewhat', 'one_sided')),
  ADD COLUMN IF NOT EXISTS would_return        text CHECK (would_return IN ('definitely', 'maybe', 'not_this_time'));
