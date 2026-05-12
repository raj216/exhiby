
-- 1. Block client writes on creator_earnings (server-only via service role)
CREATE POLICY "Deny client writes on creator_earnings"
ON public.creator_earnings
AS RESTRICTIVE
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);

-- Re-allow SELECT for creators (RESTRICTIVE above blocks all; we need SELECT to stay).
-- Restrictive policies AND with permissive ones. To preserve SELECT, scope the restrictive to write ops only.
DROP POLICY "Deny client writes on creator_earnings" ON public.creator_earnings;

CREATE POLICY "Deny client INSERT on creator_earnings"
ON public.creator_earnings AS RESTRICTIVE FOR INSERT TO anon, authenticated WITH CHECK (false);
CREATE POLICY "Deny client UPDATE on creator_earnings"
ON public.creator_earnings AS RESTRICTIVE FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "Deny client DELETE on creator_earnings"
ON public.creator_earnings AS RESTRICTIVE FOR DELETE TO anon, authenticated USING (false);

-- 2. Block client writes on creator_payouts
CREATE POLICY "Deny client INSERT on creator_payouts"
ON public.creator_payouts AS RESTRICTIVE FOR INSERT TO anon, authenticated WITH CHECK (false);
CREATE POLICY "Deny client UPDATE on creator_payouts"
ON public.creator_payouts AS RESTRICTIVE FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "Deny client DELETE on creator_payouts"
ON public.creator_payouts AS RESTRICTIVE FOR DELETE TO anon, authenticated USING (false);

-- 3. Fully deny client access to stripe_connect_accounts
CREATE POLICY "Deny all client access to stripe_connect_accounts"
ON public.stripe_connect_accounts AS RESTRICTIVE FOR ALL
TO anon, authenticated
USING (false) WITH CHECK (false);

-- 4. Defense-in-depth: tighten profiles UPDATE policies to forbid plan != 'free'
DROP POLICY IF EXISTS "Profiles: authenticated can update own" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

CREATE POLICY "Profiles: authenticated can update own"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id AND plan = 'free');

-- 5. Remove session_feedback from realtime publication (not needed)
ALTER PUBLICATION supabase_realtime DROP TABLE public.session_feedback;

-- 6. Revoke EXECUTE on trigger function from anon (not meant to be called directly)
REVOKE EXECUTE ON FUNCTION public.prevent_plan_self_upgrade() FROM anon, authenticated, public;
