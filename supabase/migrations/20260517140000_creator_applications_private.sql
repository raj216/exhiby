-- ─────────────────────────────────────────────────────────────────────────────
-- Lock down creator-applications storage (was world-readable)
--
-- The original migration created this bucket with public:true + a public-read
-- policy, so anyone with a (guessable) URL could view applicants' submitted
-- photos. This restricts reads to the file owner and admins only, and serves
-- images via short-lived signed URLs (generated client-side in AdminCreators).
--
-- Upload / replace policies are unchanged — submission still works.
-- ─────────────────────────────────────────────────────────────────────────────

-- Remove world-readable access
DROP POLICY IF EXISTS "creator_applications storage: public read" ON storage.objects;

-- Owner (the applicant, files live under their user_id folder) and admins only
CREATE POLICY "creator_applications storage: owner or admin read"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'creator-applications'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
    )
  );

-- Flip the bucket itself to private so getPublicUrl no longer serves files;
-- access is now exclusively via RLS-checked signed URLs.
UPDATE storage.buckets SET public = false WHERE id = 'creator-applications';
