
-- Attach guard trigger for tickets payment columns
DROP TRIGGER IF EXISTS tickets_user_update_guard_trg ON public.tickets;
CREATE TRIGGER tickets_user_update_guard_trg
BEFORE UPDATE ON public.tickets
FOR EACH ROW
EXECUTE FUNCTION public.tickets_user_update_guard();

-- Attach trigger to prevent client-side plan upgrades
DROP TRIGGER IF EXISTS prevent_plan_self_upgrade_trg ON public.profiles;
CREATE TRIGGER prevent_plan_self_upgrade_trg
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_plan_self_upgrade();

-- Relax the WITH CHECK so legitimate pro/plus users can still update their own profile,
-- since the trigger now blocks plan changes by authenticated users.
DROP POLICY IF EXISTS "Profiles: authenticated can update own" ON public.profiles;
CREATE POLICY "Profiles: authenticated can update own"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Revoke anonymous EXECUTE on public profile lookup functions
REVOKE EXECUTE ON FUNCTION public.get_public_profile(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_public_profile_by_profile_id(uuid) FROM anon;
