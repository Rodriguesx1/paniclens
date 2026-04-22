
-- =========================================================
-- PanicLens — Núcleo multi-tenant + diagnóstico de panic-full
-- =========================================================

-- Roles enum
CREATE TYPE public.app_role AS ENUM ('super_admin', 'org_admin', 'premium_technician', 'technician');

-- Severity / repair tiers / status enums
CREATE TYPE public.case_status AS ENUM ('open', 'analyzed', 'in_repair', 'resolved', 'escalated', 'closed');
CREATE TYPE public.severity_level AS ENUM ('low', 'moderate', 'high', 'critical');
CREATE TYPE public.confidence_label AS ENUM ('low', 'moderate', 'high', 'very_high');
CREATE TYPE public.repair_tier AS ENUM ('simple_swap', 'peripheral_diagnosis', 'connector_or_line_check', 'advanced_board_diagnosis', 'high_risk_board_repair');
CREATE TYPE public.diagnostic_category AS ENUM (
  'thermal','sensors','watchdog','battery','charging','dock_flex','front_flex',
  'proximity','face_id','camera','audio','codec','baseband','modem','nand',
  'storage','power','rail','i2c','cpu_memory','peripheral_communication','unknown'
);

-- ===========================
-- Organizations
-- ===========================
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Profiles (1:1 auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  default_org_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Memberships (user x org x role)
CREATE TABLE public.memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'technician',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, org_id, role)
);
CREATE INDEX idx_memberships_user ON public.memberships(user_id);
CREATE INDEX idx_memberships_org ON public.memberships(org_id);

-- Helpers (SECURITY DEFINER) to avoid RLS recursion
CREATE OR REPLACE FUNCTION public.is_member_of(_user UUID, _org UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.memberships WHERE user_id = _user AND org_id = _org);
$$;

CREATE OR REPLACE FUNCTION public.has_role_in_org(_user UUID, _org UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.memberships WHERE user_id = _user AND org_id = _org AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin(_user UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.memberships WHERE user_id = _user AND role = 'super_admin');
$$;

-- ===========================
-- Customers / Devices / Cases
-- ===========================
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_customers_org ON public.customers(org_id);

CREATE TABLE public.devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  commercial_model TEXT,           -- e.g. "iPhone 13 Pro"
  technical_identifier TEXT,       -- e.g. "iPhone14,2"
  serial TEXT,
  imei TEXT,
  ios_version TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_devices_org ON public.devices(org_id);
CREATE INDEX idx_devices_model ON public.devices(commercial_model);

CREATE TABLE public.cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  technician_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  device_id UUID REFERENCES public.devices(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  reported_defect TEXT,
  perceived_symptoms TEXT,
  initial_notes TEXT,
  status public.case_status NOT NULL DEFAULT 'open',
  estimated_cost NUMERIC(12,2),
  final_cost NUMERIC(12,2),
  outcome TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_cases_org_created ON public.cases(org_id, created_at DESC);
CREATE INDEX idx_cases_status ON public.cases(org_id, status);
CREATE INDEX idx_cases_technician ON public.cases(technician_id);

-- ===========================
-- Panic logs and analyses
-- ===========================
CREATE TABLE public.panic_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'paste',     -- paste | upload
  filename TEXT,
  mime_type TEXT,
  byte_size INTEGER,
  storage_path TEXT,
  raw_content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_panic_logs_case ON public.panic_logs(case_id);
CREATE INDEX idx_panic_logs_org ON public.panic_logs(org_id);

CREATE TABLE public.parsed_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  panic_log_id UUID NOT NULL REFERENCES public.panic_logs(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  parser_version TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  raw_evidences JSONB NOT NULL DEFAULT '[]'::JSONB,
  detected_categories JSONB NOT NULL DEFAULT '[]'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_parsed_logs_panic ON public.parsed_logs(panic_log_id);

CREATE TABLE public.analysis_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  panic_log_id UUID NOT NULL REFERENCES public.panic_logs(id) ON DELETE CASCADE,
  parsed_log_id UUID NOT NULL REFERENCES public.parsed_logs(id) ON DELETE CASCADE,
  engine_version TEXT NOT NULL,
  ruleset_version TEXT NOT NULL,
  executive_summary TEXT NOT NULL,
  primary_category public.diagnostic_category NOT NULL,
  severity public.severity_level NOT NULL,
  confidence_score INTEGER NOT NULL CHECK (confidence_score BETWEEN 0 AND 100),
  confidence_label public.confidence_label NOT NULL,
  risk_of_misdiagnosis INTEGER NOT NULL CHECK (risk_of_misdiagnosis BETWEEN 0 AND 100),
  likely_repair_tier public.repair_tier NOT NULL,
  likely_simple_swap_chance INTEGER NOT NULL CHECK (likely_simple_swap_chance BETWEEN 0 AND 100),
  likely_board_repair_chance INTEGER NOT NULL CHECK (likely_board_repair_chance BETWEEN 0 AND 100),
  suspected_components JSONB NOT NULL DEFAULT '[]'::JSONB,
  probable_subsystem TEXT,
  recommended_test_sequence JSONB NOT NULL DEFAULT '[]'::JSONB,
  technical_alerts JSONB NOT NULL DEFAULT '[]'::JSONB,
  bench_notes TEXT,
  full_payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_analysis_case ON public.analysis_results(case_id);
CREATE INDEX idx_analysis_org_created ON public.analysis_results(org_id, created_at DESC);
CREATE INDEX idx_analysis_category ON public.analysis_results(org_id, primary_category);

CREATE TABLE public.diagnostic_hypotheses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id UUID NOT NULL REFERENCES public.analysis_results(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  rule_id TEXT NOT NULL,
  rule_version TEXT NOT NULL,
  category public.diagnostic_category NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  title TEXT NOT NULL,
  explanation TEXT NOT NULL,
  confidence_score INTEGER NOT NULL CHECK (confidence_score BETWEEN 0 AND 100),
  suspected_components JSONB NOT NULL DEFAULT '[]'::JSONB,
  rank INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_hypotheses_analysis ON public.diagnostic_hypotheses(analysis_id);

CREATE TABLE public.diagnostic_evidences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id UUID NOT NULL REFERENCES public.analysis_results(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  category public.diagnostic_category NOT NULL,
  evidence_key TEXT NOT NULL,
  matched_text TEXT NOT NULL,
  weight INTEGER NOT NULL DEFAULT 0,
  is_conflicting BOOLEAN NOT NULL DEFAULT false,
  context TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_evidences_analysis ON public.diagnostic_evidences(analysis_id);

CREATE TABLE public.repair_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id UUID NOT NULL REFERENCES public.analysis_results(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  action_title TEXT NOT NULL,
  action_type TEXT NOT NULL,                -- inspection|swap_test|measurement|connector_check|line_check|subsystem_isolation|advanced_board_diagnosis
  priority INTEGER NOT NULL DEFAULT 0,
  difficulty TEXT NOT NULL,                 -- low|medium|high|expert
  estimated_cost TEXT,
  estimated_time TEXT,
  technical_risk TEXT NOT NULL,             -- low|medium|high
  expected_resolution_chance INTEGER NOT NULL CHECK (expected_resolution_chance BETWEEN 0 AND 100),
  why_this_action TEXT NOT NULL,
  when_to_escalate TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_suggestions_analysis ON public.repair_suggestions(analysis_id);

-- Audit log
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity TEXT,
  entity_id UUID,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_org_created ON public.audit_log(org_id, created_at DESC);

-- ===========================
-- updated_at trigger
-- ===========================
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_orgs_updated BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_customers_updated BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_devices_updated BEFORE UPDATE ON public.devices FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_cases_updated BEFORE UPDATE ON public.cases FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ===========================
-- Auto profile + org on signup
-- ===========================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  new_org_id UUID;
  org_name TEXT;
  org_slug TEXT;
BEGIN
  org_name := COALESCE(NEW.raw_user_meta_data->>'org_name', split_part(NEW.email, '@', 1) || '''s workspace');
  org_slug := lower(regexp_replace(org_name || '-' || substr(NEW.id::text, 1, 8), '[^a-z0-9]+', '-', 'g'));

  INSERT INTO public.organizations(name, slug) VALUES (org_name, org_slug) RETURNING id INTO new_org_id;

  INSERT INTO public.profiles(id, full_name, email, default_org_id)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.email, new_org_id);

  INSERT INTO public.memberships(user_id, org_id, role) VALUES (NEW.id, new_org_id, 'org_admin');
  INSERT INTO public.memberships(user_id, org_id, role) VALUES (NEW.id, new_org_id, 'premium_technician');

  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ===========================
-- Enable RLS
-- ===========================
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.panic_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parsed_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analysis_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diagnostic_hypotheses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diagnostic_evidences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repair_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- ===========================
-- RLS policies (per-org isolation)
-- ===========================

-- Orgs: members see, admins update
CREATE POLICY orgs_select ON public.organizations FOR SELECT TO authenticated
  USING (public.is_member_of(auth.uid(), id) OR public.is_super_admin(auth.uid()));
CREATE POLICY orgs_update ON public.organizations FOR UPDATE TO authenticated
  USING (public.has_role_in_org(auth.uid(), id, 'org_admin') OR public.is_super_admin(auth.uid()));

-- Profiles: self
CREATE POLICY profiles_self_select ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY profiles_self_upsert ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY profiles_self_update ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());

-- Memberships: see own and same-org admins; admins manage
CREATE POLICY memberships_select ON public.memberships FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role_in_org(auth.uid(), org_id, 'org_admin') OR public.is_super_admin(auth.uid()));
CREATE POLICY memberships_admin_all ON public.memberships FOR ALL TO authenticated
  USING (public.has_role_in_org(auth.uid(), org_id, 'org_admin') OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.has_role_in_org(auth.uid(), org_id, 'org_admin') OR public.is_super_admin(auth.uid()));

-- Generic per-org policy macro: applied to each tenant table
CREATE POLICY customers_org_all ON public.customers FOR ALL TO authenticated
  USING (public.is_member_of(auth.uid(), org_id)) WITH CHECK (public.is_member_of(auth.uid(), org_id));

CREATE POLICY devices_org_all ON public.devices FOR ALL TO authenticated
  USING (public.is_member_of(auth.uid(), org_id)) WITH CHECK (public.is_member_of(auth.uid(), org_id));

CREATE POLICY cases_org_all ON public.cases FOR ALL TO authenticated
  USING (public.is_member_of(auth.uid(), org_id)) WITH CHECK (public.is_member_of(auth.uid(), org_id));

CREATE POLICY panic_logs_org_all ON public.panic_logs FOR ALL TO authenticated
  USING (public.is_member_of(auth.uid(), org_id)) WITH CHECK (public.is_member_of(auth.uid(), org_id));

CREATE POLICY parsed_logs_org_all ON public.parsed_logs FOR ALL TO authenticated
  USING (public.is_member_of(auth.uid(), org_id)) WITH CHECK (public.is_member_of(auth.uid(), org_id));

CREATE POLICY analysis_org_all ON public.analysis_results FOR ALL TO authenticated
  USING (public.is_member_of(auth.uid(), org_id)) WITH CHECK (public.is_member_of(auth.uid(), org_id));

CREATE POLICY hypotheses_org_all ON public.diagnostic_hypotheses FOR ALL TO authenticated
  USING (public.is_member_of(auth.uid(), org_id)) WITH CHECK (public.is_member_of(auth.uid(), org_id));

CREATE POLICY evidences_org_all ON public.diagnostic_evidences FOR ALL TO authenticated
  USING (public.is_member_of(auth.uid(), org_id)) WITH CHECK (public.is_member_of(auth.uid(), org_id));

CREATE POLICY suggestions_org_all ON public.repair_suggestions FOR ALL TO authenticated
  USING (public.is_member_of(auth.uid(), org_id)) WITH CHECK (public.is_member_of(auth.uid(), org_id));

CREATE POLICY audit_org_select ON public.audit_log FOR SELECT TO authenticated
  USING (public.is_member_of(auth.uid(), org_id) OR public.is_super_admin(auth.uid()));
CREATE POLICY audit_org_insert ON public.audit_log FOR INSERT TO authenticated
  WITH CHECK (public.is_member_of(auth.uid(), org_id));
