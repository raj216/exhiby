-- Fix the public_profiles view to use security invoker mode
-- This ensures the view respects the caller's permissions, not the creator's
ALTER VIEW public.public_profiles SET (security_invoker = true);