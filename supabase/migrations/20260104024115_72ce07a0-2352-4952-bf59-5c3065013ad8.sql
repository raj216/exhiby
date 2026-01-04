-- Fix 1: Remove email column from profiles table to prevent exposure
ALTER TABLE public.profiles DROP COLUMN IF EXISTS email;

-- Update the handle_new_user trigger to not insert email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'name', NEW.raw_user_meta_data ->> 'full_name', 'Guest')
  );
  RETURN NEW;
END;
$$;

-- Fix 2: Replace overly permissive live_viewers SELECT policy with user-only access
DROP POLICY IF EXISTS "Anyone can view live viewers" ON public.live_viewers;

CREATE POLICY "Users can view their own viewer record"
ON public.live_viewers
FOR SELECT
USING (auth.uid() = user_id);