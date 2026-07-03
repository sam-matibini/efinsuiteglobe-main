-- Phase 7 — US Rails, TIN-Match Batch, Signed Filings, Consolidation Engine

CREATE TABLE public.us_payment_rails (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  rail_type TEXT NOT NULL CHECK (rail_type IN ('ach','eftps','wire')),
  nickname TEXT NOT NULL,
  bank_name TEXT,
  routing_number TEXT,
  account_number_last4 TEXT,
  account_number_encrypted TEXT,
  eftps_pin_encrypted TEXT,
  eftps_taxpayer_id TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.us_payment_rails TO authenticated;
GRANT ALL ON public.us_payment_rails TO service_role;
ALTER TABLE public.us_payment_rails ENABLE ROW LEVEL SECURITY;
CREATE POLICY "us_rails_org" ON public.us_payment_rails FOR ALL TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id))
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));

CREATE TABLE public.tin_match_batches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  batch_reference TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','submitted','completed','failed')),
  vendor_count INTEGER NOT NULL DEFAULT 0,
  matched_count INTEGER NOT NULL DEFAULT 0,
  mismatched_count INTEGER NOT NULL DEFAULT 0,
  irs_response JSONB,
  submitted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tin_match_batches TO authenticated;
GRANT ALL ON public.tin_match_batches TO service_role;
ALTER TABLE public.tin_match_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tin_batch_org" ON public.tin_match_batches FOR ALL TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id))
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));

CREATE TABLE public.tin_match_batch_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_id UUID NOT NULL REFERENCES public.tin_match_batches(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  vendor_profile_id UUID,
  tin_last4 TEXT,
  match_status TEXT NOT NULL CHECK (match_status IN ('matched','mismatch','invalid','not_found','pending')),
  match_code TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tin_match_batch_results TO authenticated;
GRANT ALL ON public.tin_match_batch_results TO service_role;
ALTER TABLE public.tin_match_batch_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tin_results_org" ON public.tin_match_batch_results FOR ALL TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id))
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));

CREATE TABLE public.signed_filing_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  filing_type TEXT NOT NULL,
  filing_reference TEXT,
  period_end DATE,
  signer_name TEXT NOT NULL,
  signer_email TEXT NOT NULL,
  signer_title TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','signed','filed','rejected','cancelled')),
  document_url TEXT,
  filing_payload JSONB,
  filed_at TIMESTAMPTZ,
  filed_reference TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.signed_filing_requests TO authenticated;
GRANT ALL ON public.signed_filing_requests TO service_role;
ALTER TABLE public.signed_filing_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "signed_filing_org" ON public.signed_filing_requests FOR ALL TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id))
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));

CREATE TABLE public.signed_filing_signatures (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id UUID NOT NULL REFERENCES public.signed_filing_requests(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  signer_name TEXT NOT NULL,
  signature_data TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  signed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.signed_filing_signatures TO authenticated;
GRANT ALL ON public.signed_filing_signatures TO service_role;
ALTER TABLE public.signed_filing_signatures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "signed_sigs_org" ON public.signed_filing_signatures FOR ALL TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id))
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));

CREATE TABLE public.consolidation_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.consolidation_groups(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  base_currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','completed','failed')),
  total_assets NUMERIC(18,2),
  total_liabilities NUMERIC(18,2),
  total_equity NUMERIC(18,2),
  total_revenue NUMERIC(18,2),
  total_expenses NUMERIC(18,2),
  net_income NUMERIC(18,2),
  elimination_summary JSONB,
  fx_summary JSONB,
  error_message TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.consolidation_runs TO authenticated;
GRANT ALL ON public.consolidation_runs TO service_role;
ALTER TABLE public.consolidation_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "consolidation_runs_org" ON public.consolidation_runs FOR ALL TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id))
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));

CREATE TRIGGER trg_us_rails_updated BEFORE UPDATE ON public.us_payment_rails
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_tin_batches_updated BEFORE UPDATE ON public.tin_match_batches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_signed_filing_updated BEFORE UPDATE ON public.signed_filing_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_us_rails_org ON public.us_payment_rails(organization_id);
CREATE INDEX idx_tin_batches_org ON public.tin_match_batches(organization_id);
CREATE INDEX idx_tin_results_batch ON public.tin_match_batch_results(batch_id);
CREATE INDEX idx_signed_filing_org ON public.signed_filing_requests(organization_id);
CREATE INDEX idx_consolidation_runs_group ON public.consolidation_runs(group_id);
