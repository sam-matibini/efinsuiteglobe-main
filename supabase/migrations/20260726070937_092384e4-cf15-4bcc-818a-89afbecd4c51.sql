
CREATE TABLE IF NOT EXISTS public.ng_tax_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  tax_category TEXT NOT NULL CHECK (tax_category IN ('sales','payroll','withholding','corporate','levy')),
  jurisdiction_level TEXT NOT NULL CHECK (jurisdiction_level IN ('federal','state','lga')),
  authority_id UUID REFERENCES public.tax_authorities(id) ON DELETE SET NULL,
  jurisdiction_code TEXT,
  base_formula JSONB DEFAULT '{}'::jsonb,
  filing_frequency TEXT NOT NULL DEFAULT 'monthly',
  remittance_due_offset_days INTEGER NOT NULL DEFAULT 21,
  default_debit_account_code TEXT,
  default_credit_account_code TEXT,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ng_tax_definitions TO authenticated;
GRANT ALL ON public.ng_tax_definitions TO service_role;
ALTER TABLE public.ng_tax_definitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read ng_tax_definitions" ON public.ng_tax_definitions
  FOR SELECT USING (organization_id IS NULL OR EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = ng_tax_definitions.organization_id AND om.user_id = auth.uid()));
CREATE POLICY "write ng_tax_definitions" ON public.ng_tax_definitions
  FOR ALL USING (organization_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = ng_tax_definitions.organization_id AND om.user_id = auth.uid() AND om.role IN ('owner','admin')))
  WITH CHECK (organization_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = ng_tax_definitions.organization_id AND om.user_id = auth.uid() AND om.role IN ('owner','admin')));

CREATE TABLE IF NOT EXISTS public.ng_tax_rate_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  definition_id UUID NOT NULL REFERENCES public.ng_tax_definitions(id) ON DELETE CASCADE,
  effective_from DATE NOT NULL,
  effective_to DATE,
  calculation_method TEXT NOT NULL CHECK (calculation_method IN ('flat','percentage','progressive','formula','tiered_turnover')),
  rate NUMERIC(10,6),
  brackets JSONB DEFAULT '[]'::jsonb,
  formula JSONB DEFAULT '{}'::jsonb,
  min_threshold NUMERIC(18,2),
  max_cap NUMERIC(18,2),
  source_reference TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.ng_tax_rate_versions (definition_id, effective_from);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ng_tax_rate_versions TO authenticated;
GRANT ALL ON public.ng_tax_rate_versions TO service_role;
ALTER TABLE public.ng_tax_rate_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rw ng_tax_rate_versions" ON public.ng_tax_rate_versions
  FOR ALL USING (EXISTS (
    SELECT 1 FROM public.ng_tax_definitions d
    LEFT JOIN public.organization_members om ON om.organization_id = d.organization_id AND om.user_id = auth.uid()
    WHERE d.id = ng_tax_rate_versions.definition_id AND (d.organization_id IS NULL OR om.user_id IS NOT NULL)))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.ng_tax_definitions d
    JOIN public.organization_members om ON om.organization_id = d.organization_id AND om.user_id = auth.uid()
    WHERE d.id = ng_tax_rate_versions.definition_id AND om.role IN ('owner','admin')));

CREATE TABLE IF NOT EXISTS public.ng_tax_service_classifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  definition_id UUID NOT NULL REFERENCES public.ng_tax_definitions(id) ON DELETE CASCADE,
  resident_rate NUMERIC(6,3) NOT NULL,
  non_resident_rate NUMERIC(6,3),
  min_threshold NUMERIC(18,2),
  effective_from DATE NOT NULL DEFAULT '2023-01-01',
  effective_to DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ng_tax_service_classifications TO authenticated;
GRANT ALL ON public.ng_tax_service_classifications TO service_role;
ALTER TABLE public.ng_tax_service_classifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rw ng_tax_service_classifications" ON public.ng_tax_service_classifications
  FOR ALL USING (organization_id IS NULL OR EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = ng_tax_service_classifications.organization_id AND om.user_id = auth.uid()))
  WITH CHECK (organization_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = ng_tax_service_classifications.organization_id AND om.user_id = auth.uid() AND om.role IN ('owner','admin')));

CREATE TABLE IF NOT EXISTS public.ng_tax_exemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  definition_id UUID NOT NULL REFERENCES public.ng_tax_definitions(id) ON DELETE CASCADE,
  scope TEXT NOT NULL CHECK (scope IN ('item','entity','jurisdiction','condition')),
  criteria JSONB NOT NULL DEFAULT '{}'::jsonb,
  effective_from DATE NOT NULL,
  effective_to DATE,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ng_tax_exemptions TO authenticated;
GRANT ALL ON public.ng_tax_exemptions TO service_role;
ALTER TABLE public.ng_tax_exemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rw exemptions" ON public.ng_tax_exemptions
  FOR ALL USING (organization_id IS NULL OR EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = ng_tax_exemptions.organization_id AND om.user_id = auth.uid()))
  WITH CHECK (organization_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = ng_tax_exemptions.organization_id AND om.user_id = auth.uid() AND om.role IN ('owner','admin')));

CREATE TABLE IF NOT EXISTS public.ng_tax_reliefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  relief_type TEXT NOT NULL CHECK (relief_type IN ('cra','pension','nhf','nhis','life_assurance','gratuity','other')),
  formula JSONB NOT NULL DEFAULT '{}'::jsonb,
  effective_from DATE NOT NULL,
  effective_to DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ng_tax_reliefs TO authenticated;
GRANT ALL ON public.ng_tax_reliefs TO service_role;
ALTER TABLE public.ng_tax_reliefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rw reliefs" ON public.ng_tax_reliefs
  FOR ALL USING (organization_id IS NULL OR EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = ng_tax_reliefs.organization_id AND om.user_id = auth.uid()))
  WITH CHECK (organization_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = ng_tax_reliefs.organization_id AND om.user_id = auth.uid() AND om.role IN ('owner','admin')));

CREATE TABLE IF NOT EXISTS public.ng_tax_account_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  definition_id UUID NOT NULL REFERENCES public.ng_tax_definitions(id) ON DELETE CASCADE,
  payable_account_id UUID REFERENCES public.accounts(id),
  expense_account_id UUID REFERENCES public.accounts(id),
  receivable_account_id UUID REFERENCES public.accounts(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, definition_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ng_tax_account_mappings TO authenticated;
GRANT ALL ON public.ng_tax_account_mappings TO service_role;
ALTER TABLE public.ng_tax_account_mappings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rw mappings" ON public.ng_tax_account_mappings
  FOR ALL USING (EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = ng_tax_account_mappings.organization_id AND om.user_id = auth.uid()))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = ng_tax_account_mappings.organization_id AND om.user_id = auth.uid() AND om.role IN ('owner','admin')));

CREATE TABLE IF NOT EXISTS public.ng_tax_filings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  definition_id UUID NOT NULL REFERENCES public.ng_tax_definitions(id) ON DELETE CASCADE,
  filing_period_id UUID REFERENCES public.tax_filing_periods(id) ON DELETE SET NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  form_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','accepted','rejected','amended')),
  form_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  total_taxable_base NUMERIC(18,2) DEFAULT 0,
  total_tax NUMERIC(18,2) DEFAULT 0,
  submitted_at TIMESTAMPTZ,
  submitted_by UUID REFERENCES auth.users(id),
  confirmation_reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ng_tax_filings TO authenticated;
GRANT ALL ON public.ng_tax_filings TO service_role;
ALTER TABLE public.ng_tax_filings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rw filings" ON public.ng_tax_filings
  FOR ALL USING (EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = ng_tax_filings.organization_id AND om.user_id = auth.uid()))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = ng_tax_filings.organization_id AND om.user_id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.ng_tax_remittances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  filing_id UUID REFERENCES public.ng_tax_filings(id) ON DELETE SET NULL,
  definition_id UUID NOT NULL REFERENCES public.ng_tax_definitions(id),
  amount NUMERIC(18,2) NOT NULL,
  payment_date DATE NOT NULL,
  bank_account_id UUID REFERENCES public.bank_accounts(id),
  reference TEXT,
  confirmation_reference TEXT,
  journal_entry_id UUID REFERENCES public.journal_entries(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','remitted','failed','reversed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ng_tax_remittances TO authenticated;
GRANT ALL ON public.ng_tax_remittances TO service_role;
ALTER TABLE public.ng_tax_remittances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rw remit" ON public.ng_tax_remittances
  FOR ALL USING (EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = ng_tax_remittances.organization_id AND om.user_id = auth.uid()))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = ng_tax_remittances.organization_id AND om.user_id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.ng_tax_transaction_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  definition_id UUID NOT NULL REFERENCES public.ng_tax_definitions(id),
  rate_version_id UUID REFERENCES public.ng_tax_rate_versions(id),
  service_classification_id UUID REFERENCES public.ng_tax_service_classifications(id),
  source_type TEXT NOT NULL CHECK (source_type IN ('invoice_line','bill_line','expense_line','payroll_line','journal_line','manual')),
  source_id UUID,
  source_parent_id UUID,
  transaction_date DATE NOT NULL,
  taxable_base NUMERIC(18,2) NOT NULL,
  tax_rate NUMERIC(10,6),
  tax_amount NUMERIC(18,2) NOT NULL,
  currency TEXT DEFAULT 'NGN',
  journal_entry_id UUID REFERENCES public.journal_entries(id) ON DELETE SET NULL,
  journal_entry_line_id UUID REFERENCES public.journal_entry_lines(id) ON DELETE SET NULL,
  filing_id UUID REFERENCES public.ng_tax_filings(id) ON DELETE SET NULL,
  remittance_id UUID REFERENCES public.ng_tax_remittances(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'accrued' CHECK (status IN ('accrued','filed','remitted','reversed')),
  breakdown JSONB DEFAULT '{}'::jsonb,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.ng_tax_transaction_ledger (organization_id, definition_id, transaction_date);
CREATE INDEX ON public.ng_tax_transaction_ledger (source_type, source_id);
CREATE INDEX ON public.ng_tax_transaction_ledger (filing_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ng_tax_transaction_ledger TO authenticated;
GRANT ALL ON public.ng_tax_transaction_ledger TO service_role;
ALTER TABLE public.ng_tax_transaction_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rw ledger" ON public.ng_tax_transaction_ledger
  FOR ALL USING (EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = ng_tax_transaction_ledger.organization_id AND om.user_id = auth.uid()))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = ng_tax_transaction_ledger.organization_id AND om.user_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.ng_tax_touch_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

DO $$ DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['ng_tax_definitions','ng_tax_rate_versions','ng_tax_service_classifications',
    'ng_tax_account_mappings','ng_tax_filings','ng_tax_remittances','ng_tax_transaction_ledger'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_updated_at ON public.%s;', t, t);
    EXECUTE format('CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON public.%s FOR EACH ROW EXECUTE FUNCTION public.ng_tax_touch_updated_at();', t, t);
  END LOOP;
END $$;

-- ============ Seed data ============
INSERT INTO public.ng_tax_definitions (organization_id, code, name, tax_category, jurisdiction_level, jurisdiction_code, filing_frequency, remittance_due_offset_days, default_debit_account_code, default_credit_account_code, description)
VALUES
  (NULL,'NG-VAT','Value Added Tax','sales','federal','NG','monthly',21,'1-01-200-VATIN','2-01-200-VATOUT','FIRS VAT 7.5%'),
  (NULL,'NG-PAYE','Pay As You Earn','payroll','state','NG','monthly',10,'6-01-100-PAYE','2-01-130-PAYE','State IRS PAYE progressive'),
  (NULL,'NG-WHT','Withholding Tax','withholding','federal','NG','monthly',21,'1-01-200-WHT','2-01-200-WHT','FIRS/SIRS WHT'),
  (NULL,'NG-PENSION-EE','Pension (Employee)','payroll','federal','NG','monthly',7,NULL,'2-01-130-PEN','PenCom 8% employee'),
  (NULL,'NG-PENSION-ER','Pension (Employer)','payroll','federal','NG','monthly',7,'6-01-100-PEN','2-01-130-PEN','PenCom 10% employer'),
  (NULL,'NG-NHF','National Housing Fund','payroll','federal','NG','monthly',30,NULL,'2-01-130-NHF','FMBN 2.5%'),
  (NULL,'NG-NHIS','National Health Insurance','payroll','federal','NG','monthly',30,'6-01-100-NHIS','2-01-130-NHIS','NHIS'),
  (NULL,'NG-NSITF','Employee Comp Scheme','payroll','federal','NG','monthly',30,'6-01-100-NSITF','2-01-130-NSITF','NSITF 1%'),
  (NULL,'NG-ITF','Industrial Training Fund','levy','federal','NG','annual',90,'6-01-100-ITF','2-01-130-ITF','ITF 1%'),
  (NULL,'NG-CIT','Companies Income Tax','corporate','federal','NG','annual',180,'8-01-100-CIT','2-01-200-CIT','CIT tiered by turnover'),
  (NULL,'NG-TET','Tertiary Education Tax','corporate','federal','NG','annual',180,'8-01-100-TET','2-01-200-TET','TET 3% of assessable profit'),
  (NULL,'NG-EDT','Education Tax (legacy)','corporate','federal','NG','annual',180,NULL,NULL,'Legacy EDT')
ON CONFLICT DO NOTHING;

WITH d AS (SELECT id, code FROM public.ng_tax_definitions WHERE organization_id IS NULL)
INSERT INTO public.ng_tax_rate_versions (definition_id, effective_from, calculation_method, rate, brackets, formula, source_reference)
SELECT id, DATE '2020-02-01', 'percentage'::text, 7.5::numeric, '[]'::jsonb, '{}'::jsonb, 'Finance Act 2020 (VAT 7.5%)' FROM d WHERE code='NG-VAT'
UNION ALL
SELECT id, DATE '2023-01-01', 'progressive', NULL::numeric,
  '[{"min":0,"max":300000,"rate":7},{"min":300000,"max":600000,"rate":11},{"min":600000,"max":1100000,"rate":15},{"min":1100000,"max":1600000,"rate":19},{"min":1600000,"max":3200000,"rate":21},{"min":3200000,"max":null,"rate":24}]'::jsonb,
  '{"cra":{"higher_of":[200000,{"mul":["gross",0.01]}],"plus":{"mul":["gross",0.20]}}}'::jsonb,
  'PITA 6th Schedule + Finance Act 2020 CRA' FROM d WHERE code='NG-PAYE'
UNION ALL
SELECT id, DATE '2023-01-01', 'percentage', 10::numeric, '[]'::jsonb, '{}'::jsonb, 'CITA WHT default 10%' FROM d WHERE code='NG-WHT'
UNION ALL
SELECT id, DATE '2014-07-01', 'percentage', 8::numeric, '[]'::jsonb, '{"base":["basic","housing","transport"]}'::jsonb, 'PRA 2014 s.4(1)(b)' FROM d WHERE code='NG-PENSION-EE'
UNION ALL
SELECT id, DATE '2014-07-01', 'percentage', 10::numeric, '[]'::jsonb, '{"base":["basic","housing","transport"]}'::jsonb, 'PRA 2014 s.4(1)(a)' FROM d WHERE code='NG-PENSION-ER'
UNION ALL
SELECT id, DATE '1992-01-01', 'percentage', 2.5::numeric, '[]'::jsonb, '{"base":["basic"]}'::jsonb, 'NHF Act s.4' FROM d WHERE code='NG-NHF'
UNION ALL
SELECT id, DATE '2022-05-19', 'percentage', 15::numeric, '[]'::jsonb, '{}'::jsonb, 'NHIA Act 2022' FROM d WHERE code='NG-NHIS'
UNION ALL
SELECT id, DATE '2010-12-17', 'percentage', 1::numeric, '[]'::jsonb, '{"base":"payroll"}'::jsonb, 'ECS Act s.33' FROM d WHERE code='NG-NSITF'
UNION ALL
SELECT id, DATE '2011-06-01', 'percentage', 1::numeric, '[]'::jsonb, '{"base":"payroll","min_employees":5}'::jsonb, 'ITF Amendment Act 2011' FROM d WHERE code='NG-ITF'
UNION ALL
SELECT id, DATE '2023-01-01', 'tiered_turnover', NULL::numeric,
  '[{"min":0,"max":25000000,"rate":0},{"min":25000000,"max":100000000,"rate":20},{"min":100000000,"max":null,"rate":30}]'::jsonb,
  '{}'::jsonb, 'CITA + Finance Act 2019/2020 turnover tiers' FROM d WHERE code='NG-CIT'
UNION ALL
SELECT id, DATE '2023-09-01', 'percentage', 3::numeric, '[]'::jsonb, '{"base":"assessable_profit"}'::jsonb, 'TETFund Act as amended by Finance Act 2023' FROM d WHERE code='NG-TET';

WITH wht AS (SELECT id FROM public.ng_tax_definitions WHERE code='NG-WHT' AND organization_id IS NULL LIMIT 1)
INSERT INTO public.ng_tax_service_classifications (organization_id, code, name, definition_id, resident_rate, non_resident_rate, min_threshold, effective_from)
SELECT NULL, t.code, t.name, wht.id, t.res::numeric, t.nonres::numeric, t.thr::numeric, DATE '2023-01-01' FROM wht,
(VALUES
  ('WHT-DIV','Dividends',10,10,NULL::int),
  ('WHT-INT','Interest',10,10,NULL),
  ('WHT-RENT','Rent',10,10,10000),
  ('WHT-ROYALTY','Royalties',10,10,NULL),
  ('WHT-DIR','Directors fees',10,10,NULL),
  ('WHT-MGMT','Management fees',10,10,NULL),
  ('WHT-PROF','Professional services',10,10,10000),
  ('WHT-CONSULT','Consultancy',10,10,10000),
  ('WHT-TECH','Technical services',10,10,10000),
  ('WHT-COMM','Commission',5,10,10000),
  ('WHT-CONSTR','Construction',2.5,5,10000),
  ('WHT-CONTR','Contracts (supply)',5,5,10000),
  ('WHT-AGENCY','Agency arrangements',10,10,NULL),
  ('WHT-INSURE','Insurance commission',10,10,NULL),
  ('WHT-HIRE','Hire, charter, lease',10,10,10000),
  ('WHT-ENT','Entertainment',5,10,NULL),
  ('WHT-DIRSHIP','Board sitting fees',10,10,NULL),
  ('WHT-DIVRE','Dividend distribution non-cash',10,10,NULL)
) t(code,name,res,nonres,thr);

INSERT INTO public.ng_tax_reliefs (organization_id, code, name, relief_type, formula, effective_from)
VALUES
  (NULL,'CRA','Consolidated Relief Allowance','cra','{"higher_of":[200000,{"mul":["gross",0.01]}],"plus":{"mul":["gross",0.20]}}'::jsonb, DATE '2020-01-13'),
  (NULL,'PEN-RELIEF','Pension Contribution Relief','pension','{"actual":"pension_employee"}'::jsonb, DATE '2014-07-01'),
  (NULL,'NHF-RELIEF','NHF Contribution Relief','nhf','{"actual":"nhf_employee"}'::jsonb, DATE '1992-01-01'),
  (NULL,'NHIS-RELIEF','NHIS Contribution Relief','nhis','{"actual":"nhis_employee"}'::jsonb, DATE '2005-01-01'),
  (NULL,'LIFE-RELIEF','Life Assurance Premium Relief','life_assurance','{"actual":"life_assurance_premium"}'::jsonb, DATE '2011-06-14');
