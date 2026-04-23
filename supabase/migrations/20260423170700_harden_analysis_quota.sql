-- Enforce billing quota at the database layer.
-- Client-side gating alone is not sufficient for production safety.

CREATE OR REPLACE FUNCTION public.can_consume_analysis(_org UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  limit_val INTEGER;
  used INTEGER;
BEGIN
  SELECT monthly_analyses_limit
    INTO limit_val
    FROM public.get_active_license_for_org(_org)
    LIMIT 1;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF limit_val IS NULL THEN
    RETURN true;
  END IF;

  SELECT COUNT(*)::int
    INTO used
    FROM public.usage_events
   WHERE org_id = _org
     AND kind = 'analysis_created'
     AND created_at >= date_trunc('month', now());

  RETURN used < limit_val;
END; $$;

CREATE OR REPLACE FUNCTION public.tg_enforce_analysis_quota()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.can_consume_analysis(NEW.org_id) THEN
    RAISE EXCEPTION 'analysis quota exceeded for organization %', NEW.org_id USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_analysis_quota ON public.analysis_results;
CREATE TRIGGER trg_analysis_quota
BEFORE INSERT ON public.analysis_results
FOR EACH ROW EXECUTE FUNCTION public.tg_enforce_analysis_quota();
