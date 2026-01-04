-- Add missing database constraints for input validation

-- Portfolio items: Add title length constraint
ALTER TABLE public.portfolio_items
  ADD CONSTRAINT portfolio_title_length CHECK (title IS NULL OR length(title) <= 200);

-- Live materials: Add length constraints for all text fields
ALTER TABLE public.live_materials
  ADD CONSTRAINT materials_name_length CHECK (length(name) > 0 AND length(name) <= 100),
  ADD CONSTRAINT materials_brand_length CHECK (brand IS NULL OR length(brand) <= 100),
  ADD CONSTRAINT materials_spec_length CHECK (spec IS NULL OR length(spec) <= 500);