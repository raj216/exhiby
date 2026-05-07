ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'free';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='profiles_plan_check') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_plan_check CHECK (plan IN ('free','pro','plus'));
  END IF;
END $$;

DROP POLICY IF EXISTS "Users can update own plan" ON public.profiles;

CREATE OR REPLACE FUNCTION public.prevent_plan_self_upgrade()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF NEW.plan IS DISTINCT FROM OLD.plan THEN
    IF auth.uid() IS NOT NULL AND NEW.plan <> 'free' THEN
      RAISE EXCEPTION 'Plan upgrades must be performed server-side after payment confirmation';
    END IF;
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS profiles_prevent_plan_self_upgrade ON public.profiles;
CREATE TRIGGER profiles_prevent_plan_self_upgrade
  BEFORE UPDATE OF plan ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_plan_self_upgrade();