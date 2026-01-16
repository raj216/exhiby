-- =============================================================
-- NOTIFICATION PREFERENCES TABLE & AUTOMATED NOTIFICATION TRIGGERS
-- =============================================================

-- 1. Create notification_preferences table
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  email_live boolean NOT NULL DEFAULT true,
  email_scheduled boolean NOT NULL DEFAULT true,
  email_reminders boolean NOT NULL DEFAULT true,
  inapp_live boolean NOT NULL DEFAULT true,
  inapp_scheduled boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own preferences
CREATE POLICY "Users can view own notification preferences"
ON public.notification_preferences FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notification preferences"
ON public.notification_preferences FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notification preferences"
ON public.notification_preferences FOR UPDATE
USING (auth.uid() = user_id);

-- Add updated_at trigger
CREATE TRIGGER update_notification_preferences_updated_at
BEFORE UPDATE ON public.notification_preferences
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Create function to ensure notification_preferences exists for user
CREATE OR REPLACE FUNCTION public.ensure_notification_preferences()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notification_preferences (user_id)
  VALUES (NEW.user_id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Create trigger on profiles to auto-create notification preferences
CREATE TRIGGER create_notification_preferences_on_profile
AFTER INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.ensure_notification_preferences();

-- 3. Create sent_emails table to track emails and avoid duplicates
CREATE TABLE IF NOT EXISTS public.sent_emails (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  email_type text NOT NULL,
  sent_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(event_id, user_id, email_type)
);

-- Enable RLS (service role only)
ALTER TABLE public.sent_emails ENABLE ROW LEVEL SECURITY;

-- 4. Enable realtime for notification_preferences
ALTER PUBLICATION supabase_realtime ADD TABLE public.notification_preferences;