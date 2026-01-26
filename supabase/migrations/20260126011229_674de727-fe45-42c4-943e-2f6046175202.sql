-- Fix: Portfolio items should require authentication for viewing
-- This prevents anonymous scraping while allowing authenticated users to view portfolios

-- Drop the existing overly permissive policy
DROP POLICY IF EXISTS "Anyone can view portfolio items" ON public.portfolio_items;

-- Create new policy that requires authentication
-- Authenticated users can view all portfolio items (for public profile discovery)
CREATE POLICY "Authenticated users can view portfolio items"
ON public.portfolio_items
FOR SELECT
TO authenticated
USING (true);