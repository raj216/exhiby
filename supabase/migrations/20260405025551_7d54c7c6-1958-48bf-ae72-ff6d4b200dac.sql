-- FIX 1: Storage upload path traversal - Replace overly permissive INSERT policies
-- Drop the vulnerable policies
DROP POLICY IF EXISTS "Allow authenticated upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated upload portfolio" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated upload profile-covers" ON storage.objects;

-- Recreate with path ownership check
CREATE POLICY "Allow authenticated upload avatars"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'avatars'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

CREATE POLICY "Allow authenticated upload portfolio"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'portfolio'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

CREATE POLICY "Allow authenticated upload profile-covers"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'profile-covers'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

-- FIX 2: Remove self-assign creator role INSERT policy (will use edge function instead)
DROP POLICY IF EXISTS "Users can self-activate creator role" ON public.user_roles;

-- FIX 3: Remove redundant service_role JWT claim policies
-- Service role bypasses RLS natively - these policies are misleading
DROP POLICY IF EXISTS "Service role can read account deletions" ON public.account_deletions;
DROP POLICY IF EXISTS "Service role can update bug reports" ON public.bug_reports;
DROP POLICY IF EXISTS "Service role can view all bug reports" ON public.bug_reports;
DROP POLICY IF EXISTS "Service role can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Service role can select all push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Service role full access on creator_earnings" ON public.creator_earnings;
DROP POLICY IF EXISTS "Service role full access on creator_payouts" ON public.creator_payouts;
DROP POLICY IF EXISTS "Service role full access" ON public.stripe_connect_accounts;
DROP POLICY IF EXISTS "Service role full access" ON public.stripe_webhook_events;