-- ─────────────────────────────────────────────────────────────────────────────
-- Bootstrap first admin account
-- Grants admin role to the founding account by email lookup.
-- Safe to run multiple times (ON CONFLICT DO NOTHING).
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role
FROM auth.users
WHERE email = 'rajmroyal26@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;
