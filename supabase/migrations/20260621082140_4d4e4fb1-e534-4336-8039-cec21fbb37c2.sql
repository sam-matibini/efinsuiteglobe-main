
-- ============= FINTRAC LCTR =============
CREATE TABLE public.fintrac_lctr_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  conductor_name TEXT,
  conductor_id TEXT,
  window_start TIMESTAMPTZ NOT NULL,
  window_end TIMESTAMPTZ NOT NULL,
  aggregate_amount NUMERIC(18,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'CAD',
  source_transaction_ids UUID[] NOT NULL DEFAULT '{}',
  report_status TEXT NOT NULL DEFAULT 'pending',
  fintrac_reference TEXT,
  filed_at TIMESTAMPTZ,
  filed_by UUID,
  due_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fintrac_lctr_reports TO authenticated;
GRANT ALL ON public.fintrac_lctr_reports TO service_role;
ALTER TABLE public.fintrac_lctr_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lctr_org_members" ON public.fintrac_lctr_reports FOR ALL TO authenticated
  USING (is_org_member(auth.uid(), organization_id))
  WITH CHECK (is_org_member(auth.uid(), organization_id));

-- ============= FINTRAC STR =============
CREATE TABLE public.fintrac_str_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  subject_name TEXT,
  subject_id TEXT,
  related_transaction_ids UUID[] NOT NULL DEFAULT '{}',
  risk_flags JSONB NOT NULL DEFAULT '[]',
  amount NUMERIC(18,2),
  currency TEXT DEFAULT 'CAD',
  narrative TEXT,
  narrative_drafted_by_ai BOOLEAN NOT NULL DEFAULT false,
  report_status TEXT NOT NULL DEFAULT 'pending',
  fintrac_reference TEXT,
  filed_at TIMESTAMPTZ,
  filed_by UUID,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  due_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fintrac_str_reports TO authenticated;
GRANT ALL ON public.fintrac_str_reports TO service_role;
ALTER TABLE public.fintrac_str_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "str_org_members" ON public.fintrac_str_reports FOR ALL TO authenticated
  USING (is_org_member(auth.uid(), organization_id))
  WITH CHECK (is_org_member(auth.uid(), organization_id));

-- ============= FINTRAC EFTR (general) =============
CREATE TABLE public.fintrac_eftr_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  direction TEXT NOT NULL DEFAULT 'outgoing',
  counterparty_name TEXT,
  counterparty_country TEXT,
  conductor_name TEXT,
  window_start TIMESTAMPTZ NOT NULL,
  window_end TIMESTAMPTZ NOT NULL,
  aggregate_amount NUMERIC(18,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'CAD',
  source_transaction_ids UUID[] NOT NULL DEFAULT '{}',
  source_kind TEXT,
  report_status TEXT NOT NULL DEFAULT 'pending',
  fintrac_reference TEXT,
  filed_at TIMESTAMPTZ,
  filed_by UUID,
  due_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fintrac_eftr_reports TO authenticated;
GRANT ALL ON public.fintrac_eftr_reports TO service_role;
ALTER TABLE public.fintrac_eftr_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "eftr_org_members" ON public.fintrac_eftr_reports FOR ALL TO authenticated
  USING (is_org_member(auth.uid(), organization_id))
  WITH CHECK (is_org_member(auth.uid(), organization_id));

-- ============= Retention locks =============
CREATE TABLE public.fintrac_retention_locks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  report_table TEXT NOT NULL,
  report_id UUID NOT NULL,
  locked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  retain_until DATE NOT NULL,
  reason TEXT,
  UNIQUE(report_table, report_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fintrac_retention_locks TO authenticated;
GRANT ALL ON public.fintrac_retention_locks TO service_role;
ALTER TABLE public.fintrac_retention_locks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "retention_org_members" ON public.fintrac_retention_locks FOR ALL TO authenticated
  USING (is_org_member(auth.uid(), organization_id))
  WITH CHECK (is_org_member(auth.uid(), organization_id));

-- Immutability trigger for filed FINTRAC reports
CREATE OR REPLACE FUNCTION public.fintrac_enforce_immutability()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' AND OLD.report_status = 'filed' THEN
    RAISE EXCEPTION 'Filed FINTRAC reports are immutable (5-year retention)';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.report_status = 'filed' AND OLD.fintrac_reference IS NOT NULL THEN
    -- Allow updating notes only
    IF NEW.aggregate_amount IS DISTINCT FROM OLD.aggregate_amount
       OR NEW.source_transaction_ids IS DISTINCT FROM OLD.source_transaction_ids
       OR NEW.fintrac_reference IS DISTINCT FROM OLD.fintrac_reference
       OR NEW.report_status IS DISTINCT FROM OLD.report_status THEN
      RAISE EXCEPTION 'Cannot modify filed FINTRAC report (5-year retention)';
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER lctr_immutable BEFORE UPDATE OR DELETE ON public.fintrac_lctr_reports
  FOR EACH ROW EXECUTE FUNCTION public.fintrac_enforce_immutability();
CREATE TRIGGER eftr_immutable BEFORE UPDATE OR DELETE ON public.fintrac_eftr_reports
  FOR EACH ROW EXECUTE FUNCTION public.fintrac_enforce_immutability();

-- updated_at touch
CREATE OR REPLACE FUNCTION public.fintrac_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER lctr_touch BEFORE UPDATE ON public.fintrac_lctr_reports
  FOR EACH ROW EXECUTE FUNCTION public.fintrac_touch_updated_at();
CREATE TRIGGER str_touch BEFORE UPDATE ON public.fintrac_str_reports
  FOR EACH ROW EXECUTE FUNCTION public.fintrac_touch_updated_at();
CREATE TRIGGER eftr_touch BEFORE UPDATE ON public.fintrac_eftr_reports
  FOR EACH ROW EXECUTE FUNCTION public.fintrac_touch_updated_at();

-- ============= RPAA Settings =============
CREATE TABLE public.rpaa_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL UNIQUE,
  is_registered BOOLEAN NOT NULL DEFAULT false,
  registration_number TEXT,
  registration_date DATE,
  safeguarding_method TEXT,
  operating_account_id UUID,
  safeguarding_account_id UUID,
  insurance_provider TEXT,
  insurance_policy_number TEXT,
  insurance_expires_on DATE,
  compliance_officer_user_id UUID,
  variance_tolerance_cad NUMERIC(18,2) NOT NULL DEFAULT 100,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rpaa_settings TO authenticated;
GRANT ALL ON public.rpaa_settings TO service_role;
ALTER TABLE public.rpaa_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rpaa_settings_org_members" ON public.rpaa_settings FOR ALL TO authenticated
  USING (is_org_member(auth.uid(), organization_id))
  WITH CHECK (is_org_member(auth.uid(), organization_id));

-- ============= RPAA Safeguarding Snapshots =============
CREATE TABLE public.rpaa_safeguarding_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  snapshot_date DATE NOT NULL,
  end_user_liability NUMERIC(18,2) NOT NULL,
  safeguarded_balance NUMERIC(18,2) NOT NULL,
  variance NUMERIC(18,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'CAD',
  breach BOOLEAN NOT NULL DEFAULT false,
  breakdown JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, snapshot_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rpaa_safeguarding_snapshots TO authenticated;
GRANT ALL ON public.rpaa_safeguarding_snapshots TO service_role;
ALTER TABLE public.rpaa_safeguarding_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rpaa_snap_org_members" ON public.rpaa_safeguarding_snapshots FOR ALL TO authenticated
  USING (is_org_member(auth.uid(), organization_id))
  WITH CHECK (is_org_member(auth.uid(), organization_id));

-- ============= RPAA Attestations =============
CREATE TABLE public.rpaa_attestations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  period_year INT NOT NULL,
  period_month INT NOT NULL,
  attestor_user_id UUID NOT NULL,
  attestor_role TEXT,
  snapshot_hash TEXT NOT NULL,
  attestation_pdf_url TEXT,
  attested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT,
  UNIQUE(organization_id, period_year, period_month)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rpaa_attestations TO authenticated;
GRANT ALL ON public.rpaa_attestations TO service_role;
ALTER TABLE public.rpaa_attestations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rpaa_attest_org_members" ON public.rpaa_attestations FOR ALL TO authenticated
  USING (is_org_member(auth.uid(), organization_id))
  WITH CHECK (is_org_member(auth.uid(), organization_id));

-- ============= RPAA Incidents =============
CREATE TABLE public.rpaa_incidents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  incident_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium',
  occurred_at TIMESTAMPTZ NOT NULL,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  description TEXT NOT NULL,
  affected_users_count INT,
  affected_amount NUMERIC(18,2),
  currency TEXT DEFAULT 'CAD',
  boc_notice_due_at TIMESTAMPTZ,
  boc_notified_at TIMESTAMPTZ,
  boc_reference TEXT,
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  reported_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rpaa_incidents TO authenticated;
GRANT ALL ON public.rpaa_incidents TO service_role;
ALTER TABLE public.rpaa_incidents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rpaa_inc_org_members" ON public.rpaa_incidents FOR ALL TO authenticated
  USING (is_org_member(auth.uid(), organization_id))
  WITH CHECK (is_org_member(auth.uid(), organization_id));

CREATE TRIGGER rpaa_settings_touch BEFORE UPDATE ON public.rpaa_settings
  FOR EACH ROW EXECUTE FUNCTION public.fintrac_touch_updated_at();
CREATE TRIGGER rpaa_incidents_touch BEFORE UPDATE ON public.rpaa_incidents
  FOR EACH ROW EXECUTE FUNCTION public.fintrac_touch_updated_at();

-- Auto-populate BoC 24h notice due
CREATE OR REPLACE FUNCTION public.rpaa_set_boc_due()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.boc_notice_due_at IS NULL THEN
    NEW.boc_notice_due_at := NEW.detected_at + INTERVAL '24 hours';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER rpaa_inc_boc_due BEFORE INSERT ON public.rpaa_incidents
  FOR EACH ROW EXECUTE FUNCTION public.rpaa_set_boc_due();

-- Indexes
CREATE INDEX idx_lctr_org_status ON public.fintrac_lctr_reports(organization_id, report_status);
CREATE INDEX idx_str_org_status ON public.fintrac_str_reports(organization_id, report_status);
CREATE INDEX idx_eftr_org_status ON public.fintrac_eftr_reports(organization_id, report_status);
CREATE INDEX idx_rpaa_snap_org_date ON public.rpaa_safeguarding_snapshots(organization_id, snapshot_date DESC);
CREATE INDEX idx_rpaa_inc_org ON public.rpaa_incidents(organization_id, occurred_at DESC);
