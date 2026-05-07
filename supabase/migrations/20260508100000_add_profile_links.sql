-- ─────────────────────────────────────────────────────────────────────────────
-- Add profile_links JSONB column to profiles
-- ─────────────────────────────────────────────────────────────────────────────
-- Each link: { id: string, label: string, url: string, type: 'website'|'social'|'shop'|'other' }

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS profile_links jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Index for querying (not usually needed but good practice)
COMMENT ON COLUMN public.profiles.profile_links IS
  'Array of link objects: [{ id, label, url, type }]';
