-- CRA Tax & Remittance centre.
-- Stores business numbers, program accounts, representative authorization
-- references, EFILE submissions, and payment records.
-- Does not store CRA passwords or client CRA login credentials.

CREATE TABLE IF NOT EXISTS public.cra_tax_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL UNIQUE,
  legal_name text NOT NULL,
  business_number text NOT NULL,
  corporation_number text,
  business_type text,
  province text,
  registered_address text,
  fiscal_year_end text,
  contact_name text,
  contact_email text,
  programs text[] NOT NULL DEFAULT '{}',
  other_program_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cra_tax_profiles_bn_check CHECK (business_number ~ '^[0-9]{9}$')
);

CREATE TABLE IF NOT EXISTS public.cra_tax_authorizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'not_started',
  representative_name text NOT NULL DEFAULT 'eFinsuite / eFinTax Advisors Ltd.',
  representative_id text NOT NULL,
  authorization_level text,
  reference text,
  requested_at timestamptz,
  confirmed_at timestamptz,
  instructions_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cra_tax_authorizations_status_check CHECK (
    status IN ('not_started', 'pending_client_confirmation', 'connected', 'revoked', 'expired')
  )
);

CREATE TABLE IF NOT EXISTS public.cra_tax_access_ceilings (
  organization_id uuid PRIMARY KEY,
  can_view boolean NOT NULL DEFAULT true,
  level_2 boolean NOT NULL DEFAULT true,
  tax_filing boolean NOT NULL DEFAULT true,
  remittance boolean NOT NULL DEFAULT true,
  administration boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cra_tax_efile_submissions (
  id text PRIMARY KEY,
  organization_id uuid NOT NULL,
  client_bn text NOT NULL,
  tax_year text NOT NULL,
  return_type text NOT NULL,
  submitted_at timestamptz,
  cra_response text,
  confirmation_number text,
  errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL,
  obligation_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cra_tax_efile_status_check CHECK (status IN ('draft', 'submitted', 'accepted', 'rejected', 'error'))
);

CREATE INDEX IF NOT EXISTS idx_cra_tax_efile_org ON public.cra_tax_efile_submissions (organization_id, submitted_at DESC);

CREATE TABLE IF NOT EXISTS public.cra_tax_centre_payments (
  id text PRIMARY KEY,
  organization_id uuid NOT NULL,
  tax_type text NOT NULL,
  cra_account text NOT NULL,
  amount numeric(14, 2) NOT NULL,
  payment_date date NOT NULL,
  due_date date NOT NULL,
  funding_account text NOT NULL,
  purpose text NOT NULL,
  status text NOT NULL,
  prepared_by text NOT NULL,
  approved_by text,
  released_at timestamptz,
  cra_confirmation text,
  wallet_deduction numeric(14, 2),
  bank_settlement numeric(14, 2),
  fee numeric(14, 2) NOT NULL DEFAULT 0,
  gl_accrual jsonb NOT NULL DEFAULT '[]'::jsonb,
  gl_settlement jsonb NOT NULL DEFAULT '[]'::jsonb,
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cra_tax_centre_payments_status_check CHECK (
    status IN (
      'draft', 'authorized', 'submitted', 'processing', 'accepted', 'settled', 'confirmed',
      'failed', 'rejected', 'cancelled', 'refunded'
    )
  ),
  CONSTRAINT cra_tax_centre_payments_four_eyes CHECK (approved_by IS NULL OR approved_by <> prepared_by)
);

CREATE INDEX IF NOT EXISTS idx_cra_tax_centre_payments_org ON public.cra_tax_centre_payments (organization_id, created_at DESC);

ALTER TABLE public.cra_tax_centre_payments
  ADD COLUMN IF NOT EXISTS rail_reference text,
  ADD COLUMN IF NOT EXISTS journal_entry_id text;

CREATE TABLE IF NOT EXISTS public.cra_tax_notices (
  id text PRIMARY KEY,
  organization_id uuid NOT NULL,
  severity text NOT NULL,
  title text NOT NULL,
  program_account text,
  body text NOT NULL,
  received_at timestamptz NOT NULL,
  read_at timestamptz,
  CONSTRAINT cra_tax_notices_severity_check CHECK (severity IN ('action', 'review', 'info'))
);

CREATE TABLE IF NOT EXISTS public.cra_tax_audit_events (
  id text PRIMARY KEY,
  organization_id uuid NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  user_email text NOT NULL,
  client_name text NOT NULL,
  action text NOT NULL,
  cra_account text,
  authorization_label text,
  efile_submission text,
  cra_response text,
  confirmation text,
  ip_device text NOT NULL DEFAULT 'Recorded'
);

CREATE INDEX IF NOT EXISTS idx_cra_tax_audit_org ON public.cra_tax_audit_events (organization_id, occurred_at DESC);

ALTER TABLE public.cra_tax_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cra_tax_authorizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cra_tax_access_ceilings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cra_tax_efile_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cra_tax_centre_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cra_tax_notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cra_tax_audit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members manage CRA tax profiles" ON public.cra_tax_profiles
  FOR ALL TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id))
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members manage CRA authorizations" ON public.cra_tax_authorizations
  FOR ALL TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id))
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members manage CRA access ceilings" ON public.cra_tax_access_ceilings
  FOR ALL TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id))
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members manage EFILE submissions" ON public.cra_tax_efile_submissions
  FOR ALL TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id))
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members manage CRA tax payments" ON public.cra_tax_centre_payments
  FOR ALL TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id))
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members manage CRA notices" ON public.cra_tax_notices
  FOR ALL TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id))
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members read CRA tax audit" ON public.cra_tax_audit_events
  FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members insert CRA tax audit" ON public.cra_tax_audit_events
  FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));
