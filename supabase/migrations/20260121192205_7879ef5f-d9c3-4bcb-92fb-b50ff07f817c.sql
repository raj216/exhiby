-- events_public is an unused view and is flagged as missing RLS.
-- Since views do not support RLS directly, remove it to eliminate the exposed surface area.
DROP VIEW IF EXISTS public.events_public;