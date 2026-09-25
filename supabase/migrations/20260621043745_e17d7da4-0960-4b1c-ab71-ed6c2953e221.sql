
-- Enums
DO $$ BEGIN
  CREATE TYPE public.settlement_processor AS ENUM ('stripe','adyen','paysafe','square','paypal','generic');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.settlement_status AS ENUM ('pending','matched','partially_matched','exception','written_off');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.settlement_match_type AS ENUM ('exact_ref','exact_amount_date','aggregate','split','fuzzy','manual');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.settlement_source AS ENUM ('stripe_api','adyen_api','paysafe_api','csv','manual');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- processor_accounts
CREATE TABLE public.processor_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  processor public.settlement_processor NOT NULL,
  external_account_id text,
  display_name text NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  expected_bank_account_id uuid REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
  api_credential_secret_name text,
  date_window_days integer NOT NULL DEFAULT 3,
  auto_sync boolean NOT NULL DEFAULT false,
  last_sync_at timestamptz,
  last_sync_cursor text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.processor_accounts TO authenticated;
GRANT ALL ON public.processor_accounts TO service_role;
ALTER TABLE public.processor_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members manage processor_accounts" ON public.processor_accounts
  FOR ALL TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id))
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));
CREATE INDEX idx_processor_accounts_org ON public.processor_accounts(organization_id);

-- settlements
CREATE TABLE public.settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  processor_account_id uuid NOT NULL REFERENCES public.processor_accounts(id) ON DELETE CASCADE,
  settlement_ref text NOT NULL,
  payout_ref text,
  settlement_date date NOT NULL,
  expected_deposit_date date,
  currency text NOT NULL DEFAULT 'USD',
  gross_amount numeric(18,2) NOT NULL DEFAULT 0,
  fees numeric(18,2) NOT NULL DEFAULT 0,
  chargebacks numeric(18,2) NOT NULL DEFAULT 0,
  refunds numeric(18,2) NOT NULL DEFAULT 0,
  reserves numeric(18,2) NOT NULL DEFAULT 0,
  net_amount numeric(18,2) NOT NULL,
  normalized_ref text,
  status public.settlement_status NOT NULL DEFAULT 'pending',
  bank_account_id uuid REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
  raw_payload jsonb,
  source public.settlement_source NOT NULL DEFAULT 'csv',
  import_batch_id uuid,
  imported_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, processor_account_id, settlement_ref)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.settlements TO authenticated;
GRANT ALL ON public.settlements TO service_role;
ALTER TABLE public.settlements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members manage settlements" ON public.settlements
  FOR ALL TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id))
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));
CREATE INDEX idx_settlements_org_date ON public.settlements(organization_id, settlement_date DESC);
CREATE INDEX idx_settlements_org_status ON public.settlements(organization_id, status);
CREATE INDEX idx_settlements_org_ref ON public.settlements(organization_id, normalized_ref);
CREATE INDEX idx_settlements_org_amount ON public.settlements(organization_id, net_amount);

-- settlement_matches
CREATE TABLE public.settlement_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  settlement_id uuid NOT NULL REFERENCES public.settlements(id) ON DELETE CASCADE,
  bank_transaction_id uuid NOT NULL REFERENCES public.bank_transactions(id) ON DELETE CASCADE,
  match_type public.settlement_match_type NOT NULL,
  confidence_score numeric(5,2) NOT NULL DEFAULT 0,
  auto_approved boolean NOT NULL DEFAULT false,
  matched_amount numeric(18,2),
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  approved_by uuid REFERENCES auth.users(id),
  approved_at timestamptz,
  reversed_at timestamptz,
  reversal_reason text,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.settlement_matches TO authenticated;
GRANT ALL ON public.settlement_matches TO service_role;
ALTER TABLE public.settlement_matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members manage settlement_matches" ON public.settlement_matches
  FOR ALL TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id))
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));
CREATE INDEX idx_settlement_matches_settlement ON public.settlement_matches(settlement_id);
CREATE INDEX idx_settlement_matches_bank ON public.settlement_matches(bank_transaction_id);
CREATE INDEX idx_settlement_matches_org ON public.settlement_matches(organization_id) WHERE reversed_at IS NULL;

-- settlement_import_batches
CREATE TABLE public.settlement_import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  processor_account_id uuid REFERENCES public.processor_accounts(id) ON DELETE SET NULL,
  source public.settlement_source NOT NULL,
  file_name text,
  imported_count integer NOT NULL DEFAULT 0,
  skipped_count integer NOT NULL DEFAULT 0,
  error_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'completed',
  errors jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.settlement_import_batches TO authenticated;
GRANT ALL ON public.settlement_import_batches TO service_role;
ALTER TABLE public.settlement_import_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members manage settlement_import_batches" ON public.settlement_import_batches
  FOR ALL TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id))
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));
CREATE INDEX idx_settlement_import_batches_org ON public.settlement_import_batches(organization_id, started_at DESC);

-- settlement_audit_log
CREATE TABLE public.settlement_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  action text NOT NULL,
  user_id uuid REFERENCES auth.users(id),
  before jsonb,
  after jsonb,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.settlement_audit_log TO authenticated;
GRANT ALL ON public.settlement_audit_log TO service_role;
ALTER TABLE public.settlement_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members view settlement_audit_log" ON public.settlement_audit_log
  FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members insert settlement_audit_log" ON public.settlement_audit_log
  FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));
CREATE INDEX idx_settlement_audit_log_entity ON public.settlement_audit_log(entity_type, entity_id);
CREATE INDEX idx_settlement_audit_log_org ON public.settlement_audit_log(organization_id, created_at DESC);

-- updated_at triggers
CREATE TRIGGER trg_processor_accounts_updated BEFORE UPDATE ON public.processor_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_settlements_updated BEFORE UPDATE ON public.settlements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_settlement_matches_updated BEFORE UPDATE ON public.settlement_matches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_settlement_import_batches_updated BEFORE UPDATE ON public.settlement_import_batches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
