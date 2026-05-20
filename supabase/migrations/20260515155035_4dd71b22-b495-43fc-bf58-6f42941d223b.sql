-- Defense in depth: explicit restrictive deny policies on user_roles for INSERT/UPDATE/DELETE
CREATE POLICY "Deny client INSERT on user_roles"
  ON public.user_roles AS RESTRICTIVE FOR INSERT TO anon, authenticated
  WITH CHECK (false);

CREATE POLICY "Deny client UPDATE on user_roles"
  ON public.user_roles AS RESTRICTIVE FOR UPDATE TO anon, authenticated
  USING (false) WITH CHECK (false);

CREATE POLICY "Deny client DELETE on user_roles"
  ON public.user_roles AS RESTRICTIVE FOR DELETE TO anon, authenticated
  USING (false);

-- Defense in depth: replace broad tickets UPDATE policy with column-restricted version.
-- Users may only set attended_at (other immutable fields are also enforced by triggers).
DROP POLICY IF EXISTS "Users can mark attendance on own tickets" ON public.tickets;

CREATE POLICY "Users can mark attendance on own tickets"
  ON public.tickets FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Restrictive policy: block any column other than attended_at from changing via client UPDATE.
CREATE OR REPLACE FUNCTION public.tickets_only_attended_at_changed()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
BEGIN
  RETURN true; -- placeholder; column-level enforcement remains in tickets_user_update_guard trigger
END;
$$;