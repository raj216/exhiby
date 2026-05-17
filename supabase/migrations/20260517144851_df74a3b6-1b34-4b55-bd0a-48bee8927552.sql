
-- ── Table ────────────────────────────────────────────────────────────────────
CREATE TABLE public.creator_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  photo_creating_url text NOT NULL,
  photo_progress_url text NOT NULL,
  photo_finished_url text NOT NULL,
  social_link text,
  answer_teaching text NOT NULL,
  answer_background text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.creator_applications ENABLE ROW LEVEL SECURITY;

-- Applicant policies
CREATE POLICY "Users can view their own application"
  ON public.creator_applications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can submit their own application"
  ON public.creator_applications FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id AND status = 'pending');

CREATE POLICY "Users can update their own pending application"
  ON public.creator_applications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id AND status = 'pending')
  WITH CHECK (auth.uid() = user_id AND status = 'pending');

-- Admin policies
CREATE POLICY "Admins can view all applications"
  ON public.creator_applications FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can update all applications"
  ON public.creator_applications FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- updated_at trigger
CREATE TRIGGER update_creator_applications_updated_at
  BEFORE UPDATE ON public.creator_applications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-grant creator role on approval
CREATE OR REPLACE FUNCTION public.creator_application_on_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.user_id, 'creator'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
    NEW.reviewed_at := COALESCE(NEW.reviewed_at, now());
    NEW.reviewed_by := COALESCE(NEW.reviewed_by, auth.uid());
  ELSIF NEW.status = 'rejected' AND (OLD.status IS DISTINCT FROM 'rejected') THEN
    NEW.reviewed_at := COALESCE(NEW.reviewed_at, now());
    NEW.reviewed_by := COALESCE(NEW.reviewed_by, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER creator_applications_on_approval
  BEFORE UPDATE ON public.creator_applications
  FOR EACH ROW EXECUTE FUNCTION public.creator_application_on_approval();

-- ── Storage bucket ──────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('creator-applications', 'creator-applications', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Creator application photos are publicly viewable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'creator-applications');

CREATE POLICY "Users can upload their own application photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'creator-applications'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update their own application photos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'creator-applications'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own application photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'creator-applications'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
