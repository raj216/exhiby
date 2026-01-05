-- Drop and recreate the function with new return type
DROP FUNCTION IF EXISTS public.get_portfolio_items(uuid);

-- Add description column to portfolio_items table (if not exists)
ALTER TABLE public.portfolio_items 
ADD COLUMN IF NOT EXISTS description TEXT;

-- Add CHECK constraints for title and description lengths (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'portfolio_items_title_length'
  ) THEN
    ALTER TABLE public.portfolio_items 
    ADD CONSTRAINT portfolio_items_title_length CHECK (char_length(title) <= 10);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'portfolio_items_description_length'
  ) THEN
    ALTER TABLE public.portfolio_items 
    ADD CONSTRAINT portfolio_items_description_length CHECK (char_length(description) <= 50);
  END IF;
END $$;

-- Recreate the get_portfolio_items function with description
CREATE FUNCTION public.get_portfolio_items(target_user_id uuid)
RETURNS TABLE(
  id uuid,
  image_url text,
  title text,
  description text,
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
    pi.description,
    pi.created_at
  FROM portfolio_items pi
  JOIN profiles p ON pi.profile_id = p.id
  WHERE p.user_id = target_user_id
  ORDER BY pi.created_at DESC;
$$;