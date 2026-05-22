-- Tickets: enforce column-level immutability at the privilege layer
REVOKE UPDATE ON public.tickets FROM anon, authenticated;
GRANT UPDATE (attended_at) ON public.tickets TO authenticated;

-- Messages: only content and read_at may be written from the client
REVOKE UPDATE ON public.messages FROM anon, authenticated;
GRANT UPDATE (content, read_at) ON public.messages TO authenticated;