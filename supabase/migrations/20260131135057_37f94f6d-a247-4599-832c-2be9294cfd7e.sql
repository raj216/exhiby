-- Table for storing account deletion reasons before deletion
CREATE TABLE public.account_deletions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  reason_option TEXT NOT NULL,
  reason_text TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.account_deletions ENABLE ROW LEVEL SECURITY;

-- Only service role can read (for admin review)
CREATE POLICY "Service role can read account deletions"
ON public.account_deletions
FOR SELECT
USING ((auth.jwt() ->> 'role'::text) = 'service_role'::text);

-- Users can insert their own deletion record
CREATE POLICY "Users can insert own deletion record"
ON public.account_deletions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Table for bug reports
CREATE TABLE public.bug_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  issue_text TEXT NOT NULL,
  page TEXT,
  screenshot_url TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bug_reports ENABLE ROW LEVEL SECURITY;

-- Users can insert their own bug reports
CREATE POLICY "Users can insert own bug reports"
ON public.bug_reports
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can view their own bug reports
CREATE POLICY "Users can view own bug reports"
ON public.bug_reports
FOR SELECT
USING (auth.uid() = user_id);

-- Service role can view all bug reports (for admin)
CREATE POLICY "Service role can view all bug reports"
ON public.bug_reports
FOR SELECT
USING ((auth.jwt() ->> 'role'::text) = 'service_role'::text);

-- Service role can update bug reports (for admin status changes)
CREATE POLICY "Service role can update bug reports"
ON public.bug_reports
FOR UPDATE
USING ((auth.jwt() ->> 'role'::text) = 'service_role'::text);