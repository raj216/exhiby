-- ─────────────────────────────────────────────────────────────────────────────
-- creator_applications
-- Stores creator verification submissions for manual review.
-- Status lifecycle: pending → approved | rejected
-- Creator role is activated only after manual approval via the admin flow.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.creator_applications (
  id                  uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id             uuid        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- Three required process photos (URLs in creator-applications storage bucket)
  photo_creating_url  text        NOT NULL,   -- hands + work visible, mid-process
  photo_progress_url  text        NOT NULL,   -- unfinished work in progress
  photo_finished_url  text        NOT NULL,   -- best completed piece

  -- Optional social / portfolio URL
  social_link         text,

  -- Two required written answers
  answer_teaching     text        NOT NULL,   -- what will people experience in sessions
  answer_background   text        NOT NULL,   -- creative background

  -- Review lifecycle
  status              text        NOT NULL DEFAULT 'pending'
                                 CHECK (status IN ('pending', 'approved', 'rejected')),
  submitted_at        timestamptz NOT NULL DEFAULT now(),
  reviewed_at         timestamptz,
  reviewed_by         uuid        REFERENCES auth.users(id),
  rejection_reason    text,

  -- One active application per user; upsert-safe on resubmission
  UNIQUE (user_id)
);

ALTER TABLE public.creator_applications ENABLE ROW LEVEL SECURITY;

-- Users can submit (insert) their own application
CREATE POLICY "creator_applications: user insert own"
  ON public.creator_applications
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own pending application (resubmit)
CREATE POLICY "creator_applications: user update own pending"
  ON public.creator_applications
  FOR UPDATE
  USING (auth.uid() = user_id AND status = 'pending')
  WITH CHECK (auth.uid() = user_id);

-- Users can read their own application to check status
CREATE POLICY "creator_applications: user read own"
  ON public.creator_applications
  FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can read all applications
CREATE POLICY "creator_applications: admin read all"
  ON public.creator_applications
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Admins can approve or reject
CREATE POLICY "creator_applications: admin update"
  ON public.creator_applications
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- ── Storage bucket for application photos ────────────────────────────────────
-- Public read so preview images load without auth.
-- Write scoped to authenticated users uploading into their own user_id folder.

INSERT INTO storage.buckets (id, name, public)
VALUES ('creator-applications', 'creator-applications', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "creator_applications storage: authenticated upload"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'creator-applications'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "creator_applications storage: owner replace"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'creator-applications'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "creator_applications storage: public read"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'creator-applications');
