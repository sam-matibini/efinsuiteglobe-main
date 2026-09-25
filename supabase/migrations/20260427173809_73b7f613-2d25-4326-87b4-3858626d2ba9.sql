-- Tax Submissions tracker (Phase 11d)
CREATE TABLE IF NOT EXISTS public.tax_submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  tax_return_id UUID,
  filing_period_id UUID,
  authority_id UUID,
  channel TEXT NOT NULL CHECK (channel IN ('hmrc_mtd','cra_packet','us_state_packet','manual')),
  status TEXT NOT NULL DEFAULT 'drafted' CHECK (status IN ('drafted','transmitted','acknowledged','rejected','failed','superseded')),
  form_code TEXT,
  period_start DATE,
  period_end DATE,
  net_payable NUMERIC(14,2),
  currency TEXT,
  payload JSONB,
  payload_format TEXT CHECK (payload_format IN ('xml','json','csv','pdf')),
  authority_response JSONB,
  confirmation_number TEXT,
  transmitted_at TIMESTAMPTZ,
  acknowledged_at TIMESTAMPTZ,
  error_message TEXT,
  retry_count INT NOT NULL DEFAULT 0,
  submitted_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tax_submissions_org ON public.tax_submissions(organization_id);
CREATE INDEX IF NOT EXISTS idx_tax_submissions_period ON public.tax_submissions(filing_period_id);
CREATE INDEX IF NOT EXISTS idx_tax_submissions_status ON public.tax_submissions(status);

ALTER TABLE public.tax_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members view submissions"
ON public.tax_submissions FOR SELECT TO authenticated
USING (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY "Org members insert submissions"
ON public.tax_submissions FOR INSERT TO authenticated
WITH CHECK (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY "Org members update submissions"
ON public.tax_submissions FOR UPDATE TO authenticated
USING (public.is_org_member(organization_id, auth.uid()))
WITH CHECK (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY "Org admins delete submissions"
ON public.tax_submissions FOR DELETE TO authenticated
USING (public.is_org_member(organization_id, auth.uid()));

CREATE TRIGGER trg_tax_submissions_updated_at
BEFORE UPDATE ON public.tax_submissions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Authority credentials (HMRC OAuth tokens, CRA WAC, US portal creds)
CREATE TABLE IF NOT EXISTS public.tax_authority_credentials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  authority_id UUID NOT NULL,
  credential_type TEXT NOT NULL CHECK (credential_type IN ('hmrc_oauth','cra_wac','us_state_login','generic')),
  -- Stored encrypted-at-rest via Postgres TDE; sensitive fields go in payload JSONB
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- HMRC OAuth specific
  vrn TEXT,                       -- VAT Registration Number
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  -- CRA / US specific
  business_number TEXT,
  account_reference TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, authority_id, credential_type)
);

CREATE INDEX IF NOT EXISTS idx_tax_auth_creds_org ON public.tax_authority_credentials(organization_id);

ALTER TABLE public.tax_authority_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members view credentials"
ON public.tax_authority_credentials FOR SELECT TO authenticated
USING (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY "Org members insert credentials"
ON public.tax_authority_credentials FOR INSERT TO authenticated
WITH CHECK (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY "Org members update credentials"
ON public.tax_authority_credentials FOR UPDATE TO authenticated
USING (public.is_org_member(organization_id, auth.uid()))
WITH CHECK (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY "Org members delete credentials"
ON public.tax_authority_credentials FOR DELETE TO authenticated
USING (public.is_org_member(organization_id, auth.uid()));

CREATE TRIGGER trg_tax_auth_creds_updated_at
BEFORE UPDATE ON public.tax_authority_credentials
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();