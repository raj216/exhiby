
-- Add unique constraint on handle (case-insensitive) 
-- First, create a unique index on lower(handle) to enforce uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_handle_unique ON public.profiles (lower(handle)) WHERE handle IS NOT NULL;
