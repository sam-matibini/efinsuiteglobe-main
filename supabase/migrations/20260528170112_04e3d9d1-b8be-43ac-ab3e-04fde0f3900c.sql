
-- ============ VENDOR TAX PROFILES ============
CREATE TABLE public.vendor_tax_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  vendor_id UUID NOT NULL,
  country TEXT NOT NULL DEFAULT 'CA',
  legal_name TEXT,
  business_number TEXT,
  sin TEXT,
  tin TEXT,
  ein TEXT,
  w_form_type TEXT,
  td1_on_file BOOLEAN NOT NULL DEFAULT false,
  slip_type_override TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state_province TEXT,
  postal_code TEXT,
  tin_match_status TEXT NOT NULL DEFAULT 'unverified',
  tin_match_checked_at TIMESTAMPTZ,
  tin_match_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, vendor_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendor_tax_profiles TO authenticated;
GRANT ALL ON public.vendor_tax_profiles TO service_role;
ALTER TABLE public.vendor_tax_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY vtp_select ON public.vendor_tax_profiles FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY vtp_insert ON public.vendor_tax_profiles FOR INSERT TO authenticated WITH CHECK (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY vtp_update ON public.vendor_tax_profiles FOR UPDATE TO authenticated USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY vtp_delete ON public.vendor_tax_profiles FOR DELETE TO authenticated USING (public.is_org_member(auth.uid(), organization_id));

-- ============ VENDOR TAX SLIPS ============
CREATE TABLE public.vendor_tax_slips (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  vendor_id UUID NOT NULL,
  tax_year INT NOT NULL,
  slip_type TEXT NOT NULL,
  slip_number TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  total_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  box_totals JSONB NOT NULL DEFAULT '{}'::jsonb,
  currency TEXT NOT NULL DEFAULT 'CAD',
  pdf_url TEXT,
  xml_url TEXT,
  issued_at TIMESTAMPTZ,
  amended_from UUID REFERENCES public.vendor_tax_slips(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, vendor_id, tax_year, slip_type)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendor_tax_slips TO authenticated;
GRANT ALL ON public.vendor_tax_slips TO service_role;
ALTER TABLE public.vendor_tax_slips ENABLE ROW LEVEL SECURITY;
CREATE POLICY vts_select ON public.vendor_tax_slips FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY vts_insert ON public.vendor_tax_slips FOR INSERT TO authenticated WITH CHECK (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY vts_update ON public.vendor_tax_slips FOR UPDATE TO authenticated USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY vts_delete ON public.vendor_tax_slips FOR DELETE TO authenticated USING (public.is_org_member(auth.uid(), organization_id));

-- ============ VENDOR TAX SLIP LINES ============
CREATE TABLE public.vendor_tax_slip_lines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slip_id UUID NOT NULL REFERENCES public.vendor_tax_slips(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  payment_id UUID,
  bill_id UUID,
  payment_date DATE NOT NULL,
  box_code TEXT NOT NULL,
  amount NUMERIC(14,2) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendor_tax_slip_lines TO authenticated;
GRANT ALL ON public.vendor_tax_slip_lines TO service_role;
ALTER TABLE public.vendor_tax_slip_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY vtsl_select ON public.vendor_tax_slip_lines FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY vtsl_insert ON public.vendor_tax_slip_lines FOR INSERT TO authenticated WITH CHECK (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY vtsl_update ON public.vendor_tax_slip_lines FOR UPDATE TO authenticated USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY vtsl_delete ON public.vendor_tax_slip_lines FOR DELETE TO authenticated USING (public.is_org_member(auth.uid(), organization_id));
CREATE INDEX idx_vtsl_slip ON public.vendor_tax_slip_lines(slip_id);

-- ============ US PAYROLL TAX RATES (global reference) ============
CREATE TABLE public.us_payroll_tax_rates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tax_year INT NOT NULL,
  jurisdiction TEXT NOT NULL,
  state_code TEXT,
  tax_type TEXT NOT NULL,
  employee_rate NUMERIC(8,5) NOT NULL DEFAULT 0,
  employer_rate NUMERIC(8,5) NOT NULL DEFAULT 0,
  wage_base NUMERIC(14,2),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tax_year, jurisdiction, tax_type)
);
GRANT SELECT ON public.us_payroll_tax_rates TO authenticated;
GRANT ALL ON public.us_payroll_tax_rates TO service_role;
ALTER TABLE public.us_payroll_tax_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY uspr_select ON public.us_payroll_tax_rates FOR SELECT TO authenticated USING (true);

-- ============ SALES TAX JURISDICTIONS (org-scoped nexus tracking) ============
CREATE TABLE public.sales_tax_jurisdictions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  country TEXT NOT NULL DEFAULT 'US',
  state_code TEXT NOT NULL,
  county TEXT,
  city TEXT,
  economic_nexus_revenue NUMERIC(14,2) NOT NULL DEFAULT 100000,
  economic_nexus_transactions INT NOT NULL DEFAULT 200,
  ytd_revenue NUMERIC(14,2) NOT NULL DEFAULT 0,
  ytd_transactions INT NOT NULL DEFAULT 0,
  nexus_status TEXT NOT NULL DEFAULT 'monitoring',
  registered BOOLEAN NOT NULL DEFAULT false,
  registration_number TEXT,
  last_checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, country, state_code, county, city)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_tax_jurisdictions TO authenticated;
GRANT ALL ON public.sales_tax_jurisdictions TO service_role;
ALTER TABLE public.sales_tax_jurisdictions ENABLE ROW LEVEL SECURITY;
CREATE POLICY stj_select ON public.sales_tax_jurisdictions FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY stj_insert ON public.sales_tax_jurisdictions FOR INSERT TO authenticated WITH CHECK (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY stj_update ON public.sales_tax_jurisdictions FOR UPDATE TO authenticated USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY stj_delete ON public.sales_tax_jurisdictions FOR DELETE TO authenticated USING (public.is_org_member(auth.uid(), organization_id));

-- ============ REMITTANCE FX RATES (global) ============
CREATE TABLE public.remittance_fx_rates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rate_date DATE NOT NULL,
  base_currency TEXT NOT NULL,
  quote_currency TEXT NOT NULL,
  rate NUMERIC(14,6) NOT NULL,
  source TEXT NOT NULL DEFAULT 'BOC',
  rate_type TEXT NOT NULL DEFAULT 'daily',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(rate_date, base_currency, quote_currency, source, rate_type)
);
GRANT SELECT ON public.remittance_fx_rates TO authenticated;
GRANT ALL ON public.remittance_fx_rates TO service_role;
ALTER TABLE public.remittance_fx_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY rfx_select ON public.remittance_fx_rates FOR SELECT TO authenticated USING (true);

-- ============ COPILOT CONVERSATIONS ============
CREATE TABLE public.copilot_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  user_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT 'New conversation',
  model TEXT NOT NULL DEFAULT 'google/gemini-2.5-flash',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.copilot_conversations TO authenticated;
GRANT ALL ON public.copilot_conversations TO service_role;
ALTER TABLE public.copilot_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY cc_select ON public.copilot_conversations FOR SELECT TO authenticated USING (user_id = auth.uid() AND public.is_org_member(auth.uid(), organization_id));
CREATE POLICY cc_insert ON public.copilot_conversations FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND public.is_org_member(auth.uid(), organization_id));
CREATE POLICY cc_update ON public.copilot_conversations FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY cc_delete ON public.copilot_conversations FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ============ COPILOT MESSAGES ============
CREATE TABLE public.copilot_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.copilot_conversations(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  user_id UUID NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  tool_calls JSONB,
  tokens INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.copilot_messages TO authenticated;
GRANT ALL ON public.copilot_messages TO service_role;
ALTER TABLE public.copilot_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY cm_select ON public.copilot_messages FOR SELECT TO authenticated USING (user_id = auth.uid() AND public.is_org_member(auth.uid(), organization_id));
CREATE POLICY cm_insert ON public.copilot_messages FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND public.is_org_member(auth.uid(), organization_id));
CREATE INDEX idx_cm_conv ON public.copilot_messages(conversation_id, created_at);

-- ============ IRS FILINGS ============
CREATE TABLE public.irs_filings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  filing_type TEXT NOT NULL,
  tax_year INT NOT NULL,
  period TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  xml_url TEXT,
  pdf_url TEXT,
  confirmation_number TEXT,
  submitted_at TIMESTAMPTZ,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.irs_filings TO authenticated;
GRANT ALL ON public.irs_filings TO service_role;
ALTER TABLE public.irs_filings ENABLE ROW LEVEL SECURITY;
CREATE POLICY irsf_select ON public.irs_filings FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY irsf_insert ON public.irs_filings FOR INSERT TO authenticated WITH CHECK (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY irsf_update ON public.irs_filings FOR UPDATE TO authenticated USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY irsf_delete ON public.irs_filings FOR DELETE TO authenticated USING (public.is_org_member(auth.uid(), organization_id));

-- ============ STORAGE BUCKETS ============
INSERT INTO storage.buckets (id, name, public) VALUES ('vendor-slips', 'vendor-slips', false)
  ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('irs-filings', 'irs-filings', false)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "vendor_slips_org_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'vendor-slips' AND public.is_org_member(auth.uid(), ((storage.foldername(name))[1])::uuid));
CREATE POLICY "vendor_slips_org_write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'vendor-slips' AND public.is_org_member(auth.uid(), ((storage.foldername(name))[1])::uuid));
CREATE POLICY "irs_filings_org_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'irs-filings' AND public.is_org_member(auth.uid(), ((storage.foldername(name))[1])::uuid));
CREATE POLICY "irs_filings_org_write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'irs-filings' AND public.is_org_member(auth.uid(), ((storage.foldername(name))[1])::uuid));

-- ============ SEEDS: US Tax Rates (2026) ============
INSERT INTO public.us_payroll_tax_rates (tax_year, jurisdiction, state_code, tax_type, employee_rate, employer_rate, wage_base, notes) VALUES
  (2026, 'Federal', NULL, 'FICA_SS', 0.062, 0.062, 176100, 'Social Security 6.2% each side'),
  (2026, 'Federal', NULL, 'FICA_MEDICARE', 0.0145, 0.0145, NULL, 'Medicare 1.45% each side (no wage base)'),
  (2026, 'Federal', NULL, 'FICA_ADDL_MEDICARE', 0.009, 0, NULL, 'Additional Medicare 0.9% employee over $200k'),
  (2026, 'Federal', NULL, 'FUTA', 0, 0.006, 7000, 'FUTA 0.6% after credit (6.0% gross)'),
  (2026, 'California', 'CA', 'SUTA', 0, 0.034, 7000, 'CA SUI default new employer'),
  (2026, 'New York', 'NY', 'SUTA', 0, 0.041, 12800, 'NY SUI default'),
  (2026, 'Texas', 'TX', 'SUTA', 0, 0.027, 9000, 'TX SUI default'),
  (2026, 'Florida', 'FL', 'SUTA', 0, 0.027, 7000, 'FL SUI default'),
  (2026, 'Washington', 'WA', 'SUTA', 0, 0.013, 72800, 'WA SUI default')
ON CONFLICT (tax_year, jurisdiction, tax_type) DO NOTHING;

-- ============ Helper RPC for copilot tool surface (read-only summaries) ============
CREATE OR REPLACE FUNCTION public.copilot_org_snapshot(_org_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
BEGIN
  IF NOT public.is_org_member(auth.uid(), _org_id) THEN
    RAISE EXCEPTION 'Not a member of organization';
  END IF;
  SELECT jsonb_build_object(
    'open_anomalies', (SELECT count(*) FROM public.treasury_anomalies WHERE organization_id = _org_id AND status = 'open'),
    'open_periods',   (SELECT count(*) FROM public.treasury_period_close WHERE organization_id = _org_id AND status <> 'closed'),
    'pending_filings',(SELECT count(*) FROM public.cra_filings WHERE organization_id = _org_id AND status IN ('draft','generated')),
    'vendor_slips_draft',(SELECT count(*) FROM public.vendor_tax_slips WHERE organization_id = _org_id AND status = 'draft')
  ) INTO result;
  RETURN result;
END;
$$;
GRANT EXECUTE ON FUNCTION public.copilot_org_snapshot(UUID) TO authenticated;
