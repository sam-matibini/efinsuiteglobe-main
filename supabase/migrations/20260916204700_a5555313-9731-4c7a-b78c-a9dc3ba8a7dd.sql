-- Beneficial ownership enrichment (FATF R24/R25, CTA, AMLR, PCMLTFA)
ALTER TABLE public.business_owners
  ADD COLUMN IF NOT EXISTS entity_type text NOT NULL DEFAULT 'person',
  ADD COLUMN IF NOT EXISTS parent_owner_id uuid REFERENCES public.business_owners(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS effective_pct numeric,
  ADD COLUMN IF NOT EXISTS is_ubo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS control_basis text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS birth_date text;

-- Addresses (CDD address verification)
CREATE TABLE IF NOT EXISTS public.case_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  line1 text NOT NULL,
  line2 text,
  city text,
  region text,
  postal_code text,
  country text NOT NULL DEFAULT 'CA',
  source text NOT NULL DEFAULT 'applicant',
  result public.check_result NOT NULL DEFAULT 'not_run',
  checks jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.case_addresses TO authenticated;
GRANT ALL ON public.case_addresses TO service_role;
ALTER TABLE public.case_addresses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "addresses read" ON public.case_addresses FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));
CREATE POLICY "addresses insert" ON public.case_addresses FOR INSERT TO authenticated WITH CHECK (public.can_write(auth.uid()));
CREATE POLICY "addresses update" ON public.case_addresses FOR UPDATE TO authenticated USING (public.can_write(auth.uid())) WITH CHECK (public.can_write(auth.uid()));

-- Transactions
CREATE TABLE IF NOT EXISTS public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  external_id text,
  direction text NOT NULL DEFAULT 'inbound',
  method text NOT NULL DEFAULT 'eft',
  channel text NOT NULL DEFAULT 'api',
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'CAD',
  amount_cad numeric NOT NULL,
  counterparty_name text,
  counterparty_country text,
  counterparty_account text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  risk_score integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'cleared',
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS transactions_case_idx ON public.transactions(case_id, occurred_at DESC);
GRANT SELECT, INSERT, UPDATE ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "transactions read" ON public.transactions FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));
CREATE POLICY "transactions insert" ON public.transactions FOR INSERT TO authenticated WITH CHECK (public.can_write(auth.uid()));
CREATE POLICY "transactions update" ON public.transactions FOR UPDATE TO authenticated USING (public.can_write(auth.uid())) WITH CHECK (public.can_write(auth.uid()));

CREATE TABLE IF NOT EXISTS public.transaction_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  rule_code text NOT NULL,
  rule_name text NOT NULL,
  severity text NOT NULL DEFAULT 'medium',
  citation text,
  detail text,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.transaction_alerts TO authenticated;
GRANT ALL ON public.transaction_alerts TO service_role;
ALTER TABLE public.transaction_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tx alerts read" ON public.transaction_alerts FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));
CREATE POLICY "tx alerts insert" ON public.transaction_alerts FOR INSERT TO authenticated WITH CHECK (public.can_write(auth.uid()));
CREATE POLICY "tx alerts update" ON public.transaction_alerts FOR UPDATE TO authenticated USING (public.can_write(auth.uid())) WITH CHECK (public.can_write(auth.uid()));

-- Regulatory reports (FINTRAC STR/LCTR/EFT, FinCEN SAR/CTR, EU STR, African FIU reports)
CREATE TABLE IF NOT EXISTS public.regulatory_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid REFERENCES public.cases(id) ON DELETE SET NULL,
  transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  report_type text NOT NULL,
  jurisdiction text NOT NULL DEFAULT 'CA',
  authority text NOT NULL DEFAULT 'FINTRAC',
  status text NOT NULL DEFAULT 'draft',
  reference text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  submitted_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.regulatory_reports TO authenticated;
GRANT ALL ON public.regulatory_reports TO service_role;
ALTER TABLE public.regulatory_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reports read" ON public.regulatory_reports FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));
CREATE POLICY "reports insert" ON public.regulatory_reports FOR INSERT TO authenticated WITH CHECK (public.can_write(auth.uid()));
CREATE POLICY "reports update" ON public.regulatory_reports FOR UPDATE TO authenticated USING (public.can_write(auth.uid())) WITH CHECK (public.can_write(auth.uid()));
CREATE TRIGGER regulatory_reports_touch BEFORE UPDATE ON public.regulatory_reports
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Webhooks
CREATE TABLE IF NOT EXISTS public.webhook_endpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url text NOT NULL,
  description text,
  secret text NOT NULL,
  events text[] NOT NULL DEFAULT '{}'::text[],
  environment text NOT NULL DEFAULT 'sandbox',
  enabled boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.webhook_endpoints TO authenticated;
GRANT ALL ON public.webhook_endpoints TO service_role;
ALTER TABLE public.webhook_endpoints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "webhooks read" ON public.webhook_endpoints FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));
CREATE POLICY "webhooks admin write" ON public.webhook_endpoints FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER webhook_endpoints_touch BEFORE UPDATE ON public.webhook_endpoints
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.webhook_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_id uuid NOT NULL REFERENCES public.webhook_endpoints(id) ON DELETE CASCADE,
  event text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  response_code integer,
  error_detail text,
  attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.webhook_deliveries TO authenticated;
GRANT ALL ON public.webhook_deliveries TO service_role;
ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deliveries read" ON public.webhook_deliveries FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));