-- Security hardening (warn-level): add a secure admin role assignment mechanism.
-- Existing schema already contains app_role enum and user_roles table.

CREATE OR REPLACE FUNCTION public.assign_admin_role(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Require authentication
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Must be authenticated';
  END IF;

  -- Only existing admins may assign admin
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can assign admin role';
  END IF;

  -- Validate input
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'target_user_id is required';
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (target_user_id, 'admin'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$$;

-- Lock down who can call it (no public execution)
REVOKE ALL ON FUNCTION public.assign_admin_role(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assign_admin_role(uuid) TO authenticated;
