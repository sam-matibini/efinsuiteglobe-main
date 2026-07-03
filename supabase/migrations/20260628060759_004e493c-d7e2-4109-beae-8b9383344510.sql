
-- Phase 5: extend existing tables
ALTER TABLE public.stripe_application_fees ADD COLUMN IF NOT EXISTS journal_entry_id uuid;
ALTER TABLE public.stripe_application_fees ADD COLUMN IF NOT EXISTS fiscal_period_id uuid;
ALTER TABLE public.settlement_disputes ADD COLUMN IF NOT EXISTS connected_account_id uuid REFERENCES public.stripe_connected_accounts(id) ON DELETE SET NULL;
ALTER TABLE public.settlement_disputes ADD COLUMN IF NOT EXISTS stripe_dispute_id text;
ALTER TABLE public.settlement_disputes ADD COLUMN IF NOT EXISTS evidence_due_by timestamptz;

-- Phase 6: 1099-K filings
CREATE TABLE IF NOT EXISTS public.stripe_1099k_filings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  connected_account_id uuid REFERENCES public.stripe_connected_accounts(id) ON DELETE CASCADE,
  tax_year integer NOT NULL,
  gross_amount numeric(18,2) NOT NULL DEFAULT 0,
  transaction_count integer NOT NULL DEFAULT 0,
  filing_status text NOT NULL DEFAULT 'draft',
  filed_at timestamptz,
  filing_reference text,
  raw jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (connected_account_id, tax_year)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stripe_1099k_filings TO authenticated;
GRANT ALL ON public.stripe_1099k_filings TO service_role;
ALTER TABLE public.stripe_1099k_filings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members manage 1099k" ON public.stripe_1099k_filings FOR ALL
USING (public.is_org_member(auth.uid(), org_id)) WITH CHECK (public.is_org_member(auth.uid(), org_id));
CREATE TRIGGER update_s1099k_updated_at BEFORE UPDATE ON public.stripe_1099k_filings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- KYC requirements log
CREATE TABLE IF NOT EXISTS public.stripe_kyc_requirements_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  connected_account_id uuid REFERENCES public.stripe_connected_accounts(id) ON DELETE CASCADE,
  snapshot_at timestamptz NOT NULL DEFAULT now(),
  currently_due jsonb DEFAULT '[]'::jsonb,
  past_due jsonb DEFAULT '[]'::jsonb,
  eventually_due jsonb DEFAULT '[]'::jsonb,
  disabled_reason text,
  raw jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stripe_kyc_requirements_log TO authenticated;
GRANT ALL ON public.stripe_kyc_requirements_log TO service_role;
ALTER TABLE public.stripe_kyc_requirements_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members read kyc log" ON public.stripe_kyc_requirements_log FOR ALL
USING (public.is_org_member(auth.uid(), org_id)) WITH CHECK (public.is_org_member(auth.uid(), org_id));
CREATE INDEX IF NOT EXISTS idx_skrl_acct ON public.stripe_kyc_requirements_log(connected_account_id, snapshot_at DESC);

-- Platform settings
CREATE TABLE IF NOT EXISTS public.stripe_platform_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL UNIQUE,
  statement_descriptor text,
  default_payout_schedule text DEFAULT 'standard',
  default_payout_interval text DEFAULT 'daily',
  negative_balance_handling text DEFAULT 'platform_covers',
  application_fee_bps integer DEFAULT 0,
  default_currency text DEFAULT 'USD',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stripe_platform_settings TO authenticated;
GRANT ALL ON public.stripe_platform_settings TO service_role;
ALTER TABLE public.stripe_platform_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members manage platform settings" ON public.stripe_platform_settings FOR ALL
USING (public.is_org_member(auth.uid(), org_id)) WITH CHECK (public.is_org_member(auth.uid(), org_id));
CREATE TRIGGER update_sps_updated_at BEFORE UPDATE ON public.stripe_platform_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
