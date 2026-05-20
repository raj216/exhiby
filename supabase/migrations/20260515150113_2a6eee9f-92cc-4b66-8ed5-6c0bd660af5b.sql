-- Drop live_viewers from realtime publication to stop broadcasting viewer user_ids
ALTER PUBLICATION supabase_realtime DROP TABLE public.live_viewers;

-- Restrict access to stripe_customer_id column on profiles (service role only)
REVOKE SELECT (stripe_customer_id) ON public.profiles FROM authenticated, anon;
REVOKE UPDATE (stripe_customer_id), INSERT (stripe_customer_id) ON public.profiles FROM authenticated, anon;