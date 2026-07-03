
-- ============ treasury_forecast_runs ============
CREATE TABLE public.treasury_forecast_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  created_by UUID,
  horizon_weeks INTEGER NOT NULL DEFAULT 13,
  horizon_months INTEGER NOT NULL DEFAULT 12,
  inputs JSONB NOT NULL DEFAULT '{}'::jsonb,
  summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.treasury_forecast_runs TO authenticated;
GRANT ALL ON public.treasury_forecast_runs TO service_role;
ALTER TABLE public.treasury_forecast_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "forecast_runs_org_select" ON public.treasury_forecast_runs FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "forecast_runs_org_insert" ON public.treasury_forecast_runs FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "forecast_runs_org_delete" ON public.treasury_forecast_runs FOR DELETE TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));

-- ============ treasury_forecast_lines ============
CREATE TABLE public.treasury_forecast_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.treasury_forecast_runs(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  bucket_type TEXT NOT NULL CHECK (bucket_type IN ('week','month')),
  bucket_start DATE NOT NULL,
  bucket_end DATE NOT NULL,
  authority TEXT NOT NULL,
  program_code TEXT,
  projected_liability NUMERIC(14,2) NOT NULL DEFAULT 0,
  projected_funding NUMERIC(14,2) NOT NULL DEFAULT 0,
  funding_gap NUMERIC(14,2) NOT NULL DEFAULT 0,
  confidence NUMERIC(5,2) NOT NULL DEFAULT 0.5,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_forecast_lines_run ON public.treasury_forecast_lines(run_id);
CREATE INDEX idx_forecast_lines_org_bucket ON public.treasury_forecast_lines(organization_id, bucket_start);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.treasury_forecast_lines TO authenticated;
GRANT ALL ON public.treasury_forecast_lines TO service_role;
ALTER TABLE public.treasury_forecast_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "forecast_lines_org_select" ON public.treasury_forecast_lines FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "forecast_lines_org_insert" ON public.treasury_forecast_lines FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));

-- ============ treasury_anomalies ============
CREATE TABLE public.treasury_anomalies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low','medium','high','critical')),
  category TEXT NOT NULL CHECK (category IN ('period_swing','missed_period','duplicate_payment','low_match_score','other')),
  authority TEXT,
  program_code TEXT,
  related_tax_payment_id UUID,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  fingerprint TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','acknowledged','dismissed','resolved')),
  assignee_user_id UUID,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, fingerprint)
);
CREATE INDEX idx_anomalies_org_status ON public.treasury_anomalies(organization_id, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.treasury_anomalies TO authenticated;
GRANT ALL ON public.treasury_anomalies TO service_role;
ALTER TABLE public.treasury_anomalies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anomalies_org_select" ON public.treasury_anomalies FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "anomalies_org_insert" ON public.treasury_anomalies FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "anomalies_org_update" ON public.treasury_anomalies FOR UPDATE TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));
CREATE TRIGGER trg_treasury_anomalies_updated
  BEFORE UPDATE ON public.treasury_anomalies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ treasury_period_close ============
CREATE TABLE public.treasury_period_close (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  authority TEXT NOT NULL,
  program_code TEXT,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  statutory_due_date DATE,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','reconciled','filed','paid','closed')),
  related_tax_payment_id UUID,
  related_filing_id UUID,
  notes TEXT,
  closed_at TIMESTAMPTZ,
  closed_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, authority, program_code, period_start, period_end)
);
CREATE INDEX idx_period_close_org_status ON public.treasury_period_close(organization_id, status);
CREATE INDEX idx_period_close_due ON public.treasury_period_close(organization_id, statutory_due_date);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.treasury_period_close TO authenticated;
GRANT ALL ON public.treasury_period_close TO service_role;
ALTER TABLE public.treasury_period_close ENABLE ROW LEVEL SECURITY;
CREATE POLICY "period_close_org_select" ON public.treasury_period_close FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "period_close_org_insert" ON public.treasury_period_close FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "period_close_org_update" ON public.treasury_period_close FOR UPDATE TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));
CREATE TRIGGER trg_treasury_period_close_updated
  BEFORE UPDATE ON public.treasury_period_close
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ auditor_portal_sessions ============
CREATE TABLE public.auditor_portal_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delegation_id UUID NOT NULL,
  organization_id UUID NOT NULL,
  auditor_user_id UUID,
  ip_address INET,
  user_agent TEXT,
  scopes_used TEXT[] NOT NULL DEFAULT '{}',
  actions_count INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ
);
CREATE INDEX idx_auditor_sessions_org ON public.auditor_portal_sessions(organization_id);
GRANT SELECT, INSERT, UPDATE ON public.auditor_portal_sessions TO authenticated;
GRANT ALL ON public.auditor_portal_sessions TO service_role;
ALTER TABLE public.auditor_portal_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auditor_sessions_org_select" ON public.auditor_portal_sessions FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id) OR auditor_user_id = auth.uid());
CREATE POLICY "auditor_sessions_insert" ON public.auditor_portal_sessions FOR INSERT TO authenticated
  WITH CHECK (auditor_user_id = auth.uid());
CREATE POLICY "auditor_sessions_update_self" ON public.auditor_portal_sessions FOR UPDATE TO authenticated
  USING (auditor_user_id = auth.uid());
