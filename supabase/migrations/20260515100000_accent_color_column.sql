-- Add accent_color column to profiles if it doesn't already exist
-- This enables creators to set a custom accent colour visible on their public profile

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS accent_color text;

-- Grant read access so the public profile page can fetch it
-- (profiles table already has RLS; this just ensures the column is selectable
--  under existing policies that allow SELECT on profiles rows)
COMMENT ON COLUMN public.profiles.accent_color IS
  'Optional hex colour set by creator, shown as a gradient overlay on their public profile cover';
