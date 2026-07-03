-- ============================================================
-- Phase 4: Compliance, Coverage & Audit Readiness
-- ============================================================

-- 1. Provincial tax authorities (reference table, globally readable)
CREATE TABLE public.provincial_tax_authorities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  jurisdiction text NOT NULL,
  programs jsonb NOT NULL DEFAULT '[]'::jsonb,
  website_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.provincial_tax_authorities TO anon, authenticated;
GRANT ALL ON public.provincial_tax_authorities TO service_role;

ALTER TABLE public.provincial_tax_authorities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Provincial authorities are public reference data"
  ON public.provincial_tax_authorities FOR SELECT
  USING (true);

INSERT INTO public.provincial_tax_authorities (code, name, jurisdiction, programs, website_url) VALUES
  ('rq',      'Revenu Québec',                   'QC', '["qst","source_deductions","corp_tax","installments"]'::jsonb, 'https://www.revenuquebec.ca'),
  ('wsib_on', 'WSIB Ontario',                    'ON', '["workers_comp"]'::jsonb,                                        'https://www.wsib.ca'),
  ('wcb_ab',  'WCB Alberta',                     'AB', '["workers_comp"]'::jsonb,                                        'https://www.wcb.ab.ca'),
  ('wcb_bc',  'WorkSafeBC',                      'BC', '["workers_comp"]'::jsonb,                                        'https://www.worksafebc.com'),
  ('wcb_sk',  'WCB Saskatchewan',                'SK', '["workers_comp"]'::jsonb,                                        'https://www.wcbsask.com'),
  ('wcb_mb',  'WCB Manitoba',                    'MB', '["workers_comp"]'::jsonb,                                        'https://www.wcb.mb.ca'),
  ('cnesst',  'CNESST',                          'QC', '["workers_comp"]'::jsonb,                                        'https://www.cnesst.gouv.qc.ca'),
  ('eht_on',  'Employer Health Tax (Ontario)',   'ON', '["eht"]'::jsonb,                                                 'https://www.ontario.ca/page/employer-health-tax-eht'),
  ('eht_bc',  'Employer Health Tax (BC)',        'BC', '["eht"]'::jsonb,                                                 'https://www2.gov.bc.ca'),
  ('eht_mb',  'Health & Post Secondary Edu Tax', 'MB', '["eht"]'::jsonb,                                                 'https://www.gov.mb.ca/finance/taxation/'),
  ('rst_mb',  'Manitoba Retail Sales Tax',       'MB', '["rst"]'::jsonb,                                                 'https://www.gov.mb.ca/finance/taxation/'),
  ('pst_sk',  'Saskatchewan PST',                'SK', '["pst"]'::jsonb,                                                 'https://sets.saskatchewan.ca'),
  ('pst_bc',  'British Columbia PST',            'BC', '["pst"]'::jsonb,                                                 'https://www2.gov.bc.ca');

-- 2. Provincial payee accounts (per-org registration of accounts at authorities)
CREATE TABLE public.provincial_payee_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  authority_id uuid NOT NULL REFERENCES public.provincial_tax_authorities(id) ON DELETE RESTRICT,
  program_code text NOT NULL,
  account_number text NOT NULL,
  account_label text,
  period_type text NOT NULL DEFAULT 'monthly',
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, authority_id, program_code, account_number)
);

CREATE INDEX idx_prov_payee_org ON public.provincial_payee_accounts(organization_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.provincial_payee_accounts TO authenticated;
GRANT ALL ON public.provincial_payee_accounts TO service_role;

ALTER TABLE public.provincial_payee_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members view provincial payees"
  ON public.provincial_payee_accounts FOR SELECT
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members manage provincial payees"
  ON public.provincial_payee_accounts FOR INSERT
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members update provincial payees"
  ON public.provincial_payee_accounts FOR UPDATE
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members delete provincial payees"
  ON public.provincial_payee_accounts FOR DELETE
  USING (public.is_org_member(auth.uid(), organization_id));

-- 3. CRA filings (XML reporting bridge)
CREATE TABLE public.cra_filings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  filing_type text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  xml_storage_path text,
  human_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft',
  confirmation_number text,
  submitted_at timestamptz,
  acknowledged_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cra_filings_status_chk CHECK (status IN ('draft','generated','submitted','accepted','rejected'))
);

CREATE INDEX idx_cra_filings_org ON public.cra_filings(organization_id);
CREATE INDEX idx_cra_filings_period ON public.cra_filings(organization_id, period_end DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cra_filings TO authenticated;
GRANT ALL ON public.cra_filings TO service_role;

ALTER TABLE public.cra_filings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members view filings"
  ON public.cra_filings FOR SELECT
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members create filings"
  ON public.cra_filings FOR INSERT
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members update filings"
  ON public.cra_filings FOR UPDATE
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Creator or admin delete filings"
  ON public.cra_filings FOR DELETE
  USING (
    public.is_org_member(auth.uid(), organization_id)
    AND (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role))
  );

-- 4. Treasury settings extensions
DO $$ BEGIN
  ALTER TABLE public.treasury_settings ADD COLUMN IF NOT EXISTS eft_provider text NOT NULL DEFAULT 'paysafe';
  ALTER TABLE public.treasury_settings ADD COLUMN IF NOT EXISTS vopay_daily_cap numeric;
  ALTER TABLE public.treasury_settings ADD COLUMN IF NOT EXISTS telpay_daily_cap numeric;
  ALTER TABLE public.treasury_settings ADD COLUMN IF NOT EXISTS stripe_payout_funding_enabled boolean NOT NULL DEFAULT false;
EXCEPTION WHEN undefined_table THEN
  -- treasury_settings table not present; skip silently
  NULL;
END $$;

-- 5. tax_payments extensions
DO $$ BEGIN
  ALTER TABLE public.tax_payments ADD COLUMN IF NOT EXISTS authority_id uuid REFERENCES public.provincial_tax_authorities(id);
  ALTER TABLE public.tax_payments ADD COLUMN IF NOT EXISTS eft_provider text;
EXCEPTION WHEN undefined_table THEN
  NULL;
END $$;

-- 6. Private storage buckets
INSERT INTO storage.buckets (id, name, public)
VALUES ('cra-filings', 'cra-filings', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('compliance-exports', 'compliance-exports', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: org members access only their own org's folder (first path segment = org_id)
CREATE POLICY "Org members read cra-filings"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'cra-filings'
    AND public.is_org_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "Org members write cra-filings"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'cra-filings'
    AND public.is_org_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "Org members update cra-filings"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'cra-filings'
    AND public.is_org_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "Org members delete cra-filings"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'cra-filings'
    AND public.is_org_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "Org members read compliance-exports"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'compliance-exports'
    AND public.is_org_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "Org members write compliance-exports"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'compliance-exports'
    AND public.is_org_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "Org members delete compliance-exports"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'compliance-exports'
    AND public.is_org_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );
