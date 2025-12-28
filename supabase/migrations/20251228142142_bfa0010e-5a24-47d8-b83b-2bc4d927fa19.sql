-- Create storage bucket for profile covers
INSERT INTO storage.buckets (id, name, public) VALUES ('profile-covers', 'profile-covers', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage bucket for portfolio
INSERT INTO storage.buckets (id, name, public) VALUES ('portfolio', 'portfolio', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for avatars bucket (may already exist, use IF NOT EXISTS pattern)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public read avatars' AND tablename = 'objects') THEN
    CREATE POLICY "Allow public read avatars" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow authenticated upload avatars' AND tablename = 'objects') THEN
    CREATE POLICY "Allow authenticated upload avatars" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.uid() IS NOT NULL);
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow users update own avatars' AND tablename = 'objects') THEN
    CREATE POLICY "Allow users update own avatars" ON storage.objects FOR UPDATE USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow users delete own avatars' AND tablename = 'objects') THEN
    CREATE POLICY "Allow users delete own avatars" ON storage.objects FOR DELETE USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
END $$;

-- Storage policies for profile-covers bucket
CREATE POLICY "Allow public read profile-covers" ON storage.objects FOR SELECT USING (bucket_id = 'profile-covers');
CREATE POLICY "Allow authenticated upload profile-covers" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'profile-covers' AND auth.uid() IS NOT NULL);
CREATE POLICY "Allow users update own profile-covers" ON storage.objects FOR UPDATE USING (bucket_id = 'profile-covers' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Allow users delete own profile-covers" ON storage.objects FOR DELETE USING (bucket_id = 'profile-covers' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Storage policies for portfolio bucket
CREATE POLICY "Allow public read portfolio" ON storage.objects FOR SELECT USING (bucket_id = 'portfolio');
CREATE POLICY "Allow authenticated upload portfolio" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'portfolio' AND auth.uid() IS NOT NULL);
CREATE POLICY "Allow users update own portfolio" ON storage.objects FOR UPDATE USING (bucket_id = 'portfolio' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Allow users delete own portfolio" ON storage.objects FOR DELETE USING (bucket_id = 'portfolio' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Create portfolio_items table
CREATE TABLE IF NOT EXISTS public.portfolio_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  title text NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on portfolio_items
ALTER TABLE public.portfolio_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for portfolio_items
-- SELECT: allow everyone to read (public portfolio)
CREATE POLICY "Anyone can view portfolio items" ON public.portfolio_items FOR SELECT USING (true);

-- INSERT: only owner can insert
CREATE POLICY "Users can insert their own portfolio items" ON public.portfolio_items FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = portfolio_items.profile_id 
    AND profiles.user_id = auth.uid()
  )
);

-- DELETE: only owner can delete
CREATE POLICY "Users can delete their own portfolio items" ON public.portfolio_items FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = portfolio_items.profile_id 
    AND profiles.user_id = auth.uid()
  )
);

-- UPDATE: only owner can update
CREATE POLICY "Users can update their own portfolio items" ON public.portfolio_items FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = portfolio_items.profile_id 
    AND profiles.user_id = auth.uid()
  )
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_portfolio_items_profile_id ON public.portfolio_items(profile_id);

-- Create a function to get portfolio items by user_id (for public access)
CREATE OR REPLACE FUNCTION public.get_portfolio_items(target_user_id uuid)
RETURNS TABLE (
  id uuid,
  image_url text,
  title text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    pi.id,
    pi.image_url,
    pi.title,
    pi.created_at
  FROM public.portfolio_items pi
  JOIN public.profiles p ON p.id = pi.profile_id
  WHERE p.user_id = target_user_id
  ORDER BY pi.created_at DESC;
$$;