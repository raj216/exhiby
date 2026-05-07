-- Add plan column to profiles for Free / Pro / Studio Plus tiers
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'free'
  CHECK (plan IN ('free', 'pro', 'plus'));

-- Allow users to update their own plan (downgrade to free)
-- Upgrades to pro/plus are controlled server-side or by admin
CREATE POLICY IF NOT EXISTS "Users can update own plan"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
