
-- Status enum
CREATE TYPE public.license_status AS ENUM ('active', 'trial', 'suspended', 'expired', 'revoked');

CREATE TABLE public.plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  monthly_analyses_limit INTEGER,        -- NULL = ilimitado
  monthly_cases_limit INTEGER,
  members_limit INTEGER,
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  monthly_price_cents INTEGER NOT NULL DEFAULT 0,
  is_public BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plans_read_all" ON public.plans FOR SELECT TO authenticated USING (true);
CREATE POLICY "plans_super_admin_write" ON public.plans FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

CREATE TRIGGER trg_plans_updated BEFORE UPDATE ON public.plans
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.licenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.plans(id),
  license_key TEXT NOT NULL UNIQUE,
  status license_status NOT NULL DEFAULT 'active',
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,                  -- NULL = vitalícia
  monthly_analyses_limit_override INTEGER, -- NULL usa o do plano
  members_limit_override INTEGER,
  notes TEXT,
  issued_by UUID,                          -- super_admin que emitiu
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_licenses_org ON public.licenses(org_id);
CREATE INDEX idx_licenses_status ON public.licenses(status);

ALTER TABLE public.licenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "licenses_member_read" ON public.licenses
  FOR SELECT TO authenticated
  USING (public.is_member_of(auth.uid(), org_id) OR public.is_super_admin(auth.uid()));

CREATE POLICY "licenses_super_admin_write" ON public.licenses
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

CREATE TRIGGER trg_licenses_updated BEFORE UPDATE ON public.licenses
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.usage_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL,
  user_id UUID,
  kind TEXT NOT NULL,            -- 'analysis_created'
  ref_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_usage_org_date ON public.usage_events(org_id, created_at DESC);
ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "usage_org_read" ON public.usage_events FOR SELECT TO authenticated
  USING (public.is_member_of(auth.uid(), org_id) OR public.is_super_admin(auth.uid()));
CREATE POLICY "usage_org_insert" ON public.usage_events FOR INSERT TO authenticated
  WITH CHECK (public.is_member_of(auth.uid(), org_id) AND user_id = auth.uid());

-- Helpers
CREATE OR REPLACE FUNCTION public.get_active_license_for_org(_org UUID)
RETURNS TABLE (
  license_id UUID, plan_code TEXT, plan_name TEXT, status license_status,
  monthly_analyses_limit INTEGER, members_limit INTEGER, expires_at TIMESTAMPTZ, features JSONB
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT l.id, p.code, p.name, l.status,
    COALESCE(l.monthly_analyses_limit_override, p.monthly_analyses_limit),
    COALESCE(l.members_limit_override, p.members_limit),
    l.expires_at, p.features
  FROM public.licenses l
  JOIN public.plans p ON p.id = l.plan_id
  WHERE l.org_id = _org
    AND l.status IN ('active','trial')
    AND (l.expires_at IS NULL OR l.expires_at > now())
  ORDER BY l.created_at DESC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.count_analyses_this_month(_org UUID)
RETURNS INTEGER
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COUNT(*)::int FROM public.usage_events
   WHERE org_id = _org AND kind = 'analysis_created'
     AND created_at >= date_trunc('month', now());
$$;

CREATE OR REPLACE FUNCTION public.can_consume_analysis(_org UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE limit_val INTEGER; used INTEGER;
BEGIN
  SELECT monthly_analyses_limit INTO limit_val FROM public.get_active_license_for_org(_org);
  IF limit_val IS NULL THEN RETURN true; END IF;  -- ilimitado ou sem licença ativa = bloqueado
  -- Se não houve linha, limit_val é NULL e ainda bloqueamos abaixo:
  IF NOT FOUND THEN RETURN false; END IF;
  used := public.count_analyses_this_month(_org);
  RETURN used < limit_val;
END; $$;

-- Seed planos
INSERT INTO public.plans (code, name, description, monthly_analyses_limit, monthly_cases_limit, members_limit, features, monthly_price_cents, sort_order) VALUES
('free',       'Free',       'Avaliação inicial. 5 análises/mês, sem PDF.',                      5,    5,   1,  '["basic_analysis"]'::jsonb,                                                          0,    1),
('pro',        'Pro',        'Bancada individual: 100 análises/mês, PDF, KB completa.',         100,   200, 2,  '["basic_analysis","pdf_export","knowledge_base","similar_cases"]'::jsonb,             14900, 2),
('business',   'Business',   'Equipes: 500 análises/mês, multi-técnico, dashboard avançado.',   500,  1000, 8,  '["basic_analysis","pdf_export","knowledge_base","similar_cases","advanced_dashboard","multi_user"]'::jsonb, 49900, 3),
('enterprise', 'Enterprise', 'Volume ilimitado, suporte dedicado, regras customizadas.',         NULL, NULL, NULL,'["basic_analysis","pdf_export","knowledge_base","similar_cases","advanced_dashboard","multi_user","custom_rules","priority_support"]'::jsonb, 0, 4);

-- Licença Enterprise vitalícia para OnTec
INSERT INTO public.licenses (org_id, plan_id, license_key, status, notes, issued_by)
SELECT 'd5630083-a872-49e9-860f-8c2cb7bd9eb0',
       p.id,
       'PL-ENT-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 16)),
       'active',
       'Licença vitalícia super admin (OnTec)',
       '0ee9cde3-8e77-4f1c-8b28-8b981808f410'
FROM public.plans p WHERE p.code = 'enterprise';
