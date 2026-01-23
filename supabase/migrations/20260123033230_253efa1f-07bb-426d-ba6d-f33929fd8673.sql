-- Fix profiles access for authenticated users (prevents "permission denied for table profiles")

-- Ensure roles can use the schema
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Lock down table privileges, then re-grant explicitly
REVOKE ALL ON TABLE public.profiles FROM anon, authenticated;

-- Allow authenticated users to read the columns our client queries (including user_id for filtering own row)
GRANT SELECT (id, user_id, created_at, updated_at, is_founding_member, founding_number, name, avatar_url, handle, bio, website, cover_url)
  ON TABLE public.profiles TO authenticated;

-- Allow anon to read only safe public columns (no user_id)
GRANT SELECT (id, created_at, updated_at, is_founding_member, founding_number, name, avatar_url, handle, bio, website, cover_url)
  ON TABLE public.profiles TO anon;

-- Allow authenticated users to create/update their profile row
GRANT INSERT, UPDATE ON TABLE public.profiles TO authenticated;

-- Ensure RLS is enabled
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop conflicting policies if they exist (idempotent)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='Profiles: authenticated can select own') THEN
    DROP POLICY "Profiles: authenticated can select own" ON public.profiles;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='Profiles: authenticated can insert own') THEN
    DROP POLICY "Profiles: authenticated can insert own" ON public.profiles;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='Profiles: authenticated can update own') THEN
    DROP POLICY "Profiles: authenticated can update own" ON public.profiles;
  END IF;
END $$;

-- Authenticated users can read only their own profile row
CREATE POLICY "Profiles: authenticated can select own"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Authenticated users can insert only their own profile row
CREATE POLICY "Profiles: authenticated can insert own"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Authenticated users can update only their own profile row
CREATE POLICY "Profiles: authenticated can update own"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
