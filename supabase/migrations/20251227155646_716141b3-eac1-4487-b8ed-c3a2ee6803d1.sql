-- Add input validation constraints to profiles table
ALTER TABLE public.profiles
  ADD CONSTRAINT name_length CHECK (length(name) > 0 AND length(name) <= 100),
  ADD CONSTRAINT bio_length CHECK (bio IS NULL OR length(bio) <= 150),
  ADD CONSTRAINT handle_length CHECK (handle IS NULL OR (length(handle) >= 3 AND length(handle) <= 30)),
  ADD CONSTRAINT handle_format CHECK (handle IS NULL OR handle ~ '^[a-zA-Z0-9_]+$'),
  ADD CONSTRAINT website_format CHECK (website IS NULL OR website ~ '^https?://');

-- Add input validation constraints to events table
ALTER TABLE public.events
  ADD CONSTRAINT title_length CHECK (length(title) > 0 AND length(title) <= 100),
  ADD CONSTRAINT description_length CHECK (description IS NULL OR length(description) <= 500),
  ADD CONSTRAINT price_valid CHECK (price >= 0 AND price <= 9999.99);