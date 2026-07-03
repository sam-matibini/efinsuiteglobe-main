
-- =========================================================
-- Payroll payment batches
-- =========================================================
CREATE TABLE IF NOT EXISTS public.payroll_payment_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  pay_run_id uuid NOT NULL REFERENCES public.pay_runs(id) ON DELETE CASCADE,
  batch_number text NOT NULL,
  pay_date date NOT NULL DEFAULT CURRENT_DATE,
  funding_bank_account_id uuid REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
  total_net numeric(15,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'CAD',
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','approved','processing','completed','partial','failed','cancelled')),
  provider text NOT NULL DEFAULT 'manual'
    CHECK (provider IN ('stripe','plaid','manual','wire','cheque','wallet')),
  provider_batch_id text,
  approval_state text NOT NULL DEFAULT 'draft'
    CHECK (approval_state IN ('draft','pending_review','pending_approval','approved','rejected')),
  originator_id uuid,
  reviewed_by uuid,
  reviewed_at timestamptz,
  approved_by uuid,
  approved_at timestamptz,
  submitted_by uuid,
  submitted_at timestamptz,
  completed_at timestamptz,
  notes text,
  metadata jsonb DEFAULT '{}'::jsonb,
  journal_entry_id uuid REFERENCES public.journal_entries(id) ON DELETE SET NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, batch_number)
);
CREATE INDEX IF NOT EXISTS idx_payroll_batches_org ON public.payroll_payment_batches(organization_id);
CREATE INDEX IF NOT EXISTS idx_payroll_batches_run ON public.payroll_payment_batches(pay_run_id);

ALTER TABLE public.payroll_payment_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members view payroll batches" ON public.payroll_payment_batches
  FOR SELECT TO authenticated USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "Org members insert payroll batches" ON public.payroll_payment_batches
  FOR INSERT TO authenticated WITH CHECK (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "Org members update payroll batches" ON public.payroll_payment_batches
  FOR UPDATE TO authenticated USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "Org members delete payroll batches" ON public.payroll_payment_batches
  FOR DELETE TO authenticated USING (public.is_org_member(organization_id, auth.uid()));

-- =========================================================
-- Payroll payment items
-- =========================================================
CREATE TABLE IF NOT EXISTS public.payroll_payment_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.payroll_payment_batches(id) ON DELETE CASCADE,
  pay_stub_id uuid REFERENCES public.pay_stubs(id) ON DELETE SET NULL,
  employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  amount numeric(15,2) NOT NULL,
  currency text NOT NULL DEFAULT 'CAD',
  rail text NOT NULL DEFAULT 'ach'
    CHECK (rail IN ('instant','ach','eft','wire','wallet_stripe','wallet_paddle','cheque','manual')),
  destination_institution text,
  destination_transit text,
  destination_account_masked text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','processing','completed','failed','cancelled','reversed')),
  provider_transfer_id text,
  failure_reason text,
  journal_entry_id uuid REFERENCES public.journal_entries(id) ON DELETE SET NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payroll_items_batch ON public.payroll_payment_items(batch_id);
CREATE INDEX IF NOT EXISTS idx_payroll_items_stub ON public.payroll_payment_items(pay_stub_id);

ALTER TABLE public.payroll_payment_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members view payroll items" ON public.payroll_payment_items
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.payroll_payment_batches b
    WHERE b.id = batch_id AND public.is_org_member(b.organization_id, auth.uid())));
CREATE POLICY "Org members insert payroll items" ON public.payroll_payment_items
  FOR INSERT TO authenticated WITH CHECK (EXISTS (
    SELECT 1 FROM public.payroll_payment_batches b
    WHERE b.id = batch_id AND public.is_org_member(b.organization_id, auth.uid())));
CREATE POLICY "Org members update payroll items" ON public.payroll_payment_items
  FOR UPDATE TO authenticated USING (EXISTS (
    SELECT 1 FROM public.payroll_payment_batches b
    WHERE b.id = batch_id AND public.is_org_member(b.organization_id, auth.uid())));
CREATE POLICY "Org members delete payroll items" ON public.payroll_payment_items
  FOR DELETE TO authenticated USING (EXISTS (
    SELECT 1 FROM public.payroll_payment_batches b
    WHERE b.id = batch_id AND public.is_org_member(b.organization_id, auth.uid())));

-- =========================================================
-- Approval columns on existing payment tables
-- =========================================================
ALTER TABLE public.tax_payments
  ADD COLUMN IF NOT EXISTS approval_state text NOT NULL DEFAULT 'approved'
    CHECK (approval_state IN ('draft','pending_review','pending_approval','approved','rejected')),
  ADD COLUMN IF NOT EXISTS originator_id uuid,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS rail text DEFAULT 'manual'
    CHECK (rail IN ('instant','ach','eft','wire','wallet_stripe','wallet_paddle','cheque','manual'));

ALTER TABLE public.ap_payment_batches
  ADD COLUMN IF NOT EXISTS approval_state text NOT NULL DEFAULT 'approved'
    CHECK (approval_state IN ('draft','pending_review','pending_approval','approved','rejected')),
  ADD COLUMN IF NOT EXISTS originator_id uuid,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

ALTER TABLE public.ap_payment_batch_items
  ADD COLUMN IF NOT EXISTS rail text DEFAULT 'ach'
    CHECK (rail IN ('instant','ach','eft','wire','wallet_stripe','wallet_paddle','cheque','manual'));

-- =========================================================
-- payment_approvals (shared workflow)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.payment_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  entity_type text NOT NULL CHECK (entity_type IN ('tax_payment','ap_batch','payroll_batch')),
  entity_id uuid NOT NULL,
  step text NOT NULL CHECK (step IN ('review','approve')),
  required_role text,
  assigned_to uuid,
  decided_by uuid,
  decision text NOT NULL DEFAULT 'pending' CHECK (decision IN ('pending','approved','rejected')),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_payment_approvals_entity ON public.payment_approvals(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_payment_approvals_org ON public.payment_approvals(organization_id);

ALTER TABLE public.payment_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members view approvals" ON public.payment_approvals
  FOR SELECT TO authenticated USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "Org members insert approvals" ON public.payment_approvals
  FOR INSERT TO authenticated WITH CHECK (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "Org members update approvals" ON public.payment_approvals
  FOR UPDATE TO authenticated USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));

-- =========================================================
-- Wallet balances (fintech wallet draws)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.wallet_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('stripe','paddle','plaid')),
  balance numeric(15,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'CAD',
  last_synced_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, provider, currency)
);

ALTER TABLE public.wallet_balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members view wallets" ON public.wallet_balances
  FOR SELECT TO authenticated USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "Org members insert wallets" ON public.wallet_balances
  FOR INSERT TO authenticated WITH CHECK (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "Org members update wallets" ON public.wallet_balances
  FOR UPDATE TO authenticated USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));

-- =========================================================
-- bank_accounts.rails_supported
-- =========================================================
ALTER TABLE public.bank_accounts
  ADD COLUMN IF NOT EXISTS rails_supported text[] NOT NULL DEFAULT ARRAY[]::text[];

-- =========================================================
-- organizations.treasury_approval_policy
-- =========================================================
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS treasury_approval_policy jsonb NOT NULL DEFAULT
    '{"dual_control": false, "approval_threshold": 5000, "reviewer_role": "accountant", "approver_role": "admin"}'::jsonb;

-- =========================================================
-- record_payment_decision RPC
-- =========================================================
CREATE OR REPLACE FUNCTION public.record_payment_decision(
  p_entity_type text,
  p_entity_id uuid,
  p_step text,
  p_decision text,
  p_comment text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_org uuid;
  v_originator uuid;
  v_state text;
  v_table text;
  v_new_state text;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_entity_type NOT IN ('tax_payment','ap_batch','payroll_batch') THEN
    RAISE EXCEPTION 'Invalid entity_type';
  END IF;
  IF p_step NOT IN ('review','approve') THEN RAISE EXCEPTION 'Invalid step'; END IF;
  IF p_decision NOT IN ('approved','rejected') THEN RAISE EXCEPTION 'Invalid decision'; END IF;

  v_table := CASE p_entity_type
    WHEN 'tax_payment' THEN 'tax_payments'
    WHEN 'ap_batch' THEN 'ap_payment_batches'
    WHEN 'payroll_batch' THEN 'payroll_payment_batches'
  END;

  EXECUTE format('SELECT organization_id, originator_id, approval_state FROM public.%I WHERE id = $1', v_table)
    INTO v_org, v_originator, v_state USING p_entity_id;

  IF v_org IS NULL THEN RAISE EXCEPTION 'Payment not found'; END IF;
  IF NOT public.is_org_member(v_org, v_user) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF v_originator IS NOT NULL AND v_originator = v_user THEN
    RAISE EXCEPTION 'Originator cannot self-approve';
  END IF;

  IF p_decision = 'rejected' THEN
    v_new_state := 'rejected';
  ELSIF p_step = 'review' THEN
    v_new_state := 'pending_approval';
  ELSE
    v_new_state := 'approved';
  END IF;

  INSERT INTO public.payment_approvals(
    organization_id, entity_type, entity_id, step, decided_by, decision, comment, decided_at
  ) VALUES (
    v_org, p_entity_type, p_entity_id, p_step, v_user, p_decision, p_comment, now()
  );

  IF p_step = 'review' THEN
    EXECUTE format('UPDATE public.%I SET approval_state = $1, reviewed_by = $2, reviewed_at = now(), updated_at = now() WHERE id = $3', v_table)
      USING v_new_state, v_user, p_entity_id;
  ELSE
    EXECUTE format('UPDATE public.%I SET approval_state = $1, approved_by = $2, approved_at = now(), updated_at = now() WHERE id = $3', v_table)
      USING v_new_state, v_user, p_entity_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'approval_state', v_new_state);
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_payment_decision(text, uuid, text, text, text) TO authenticated;

-- =========================================================
-- Triggers for updated_at
-- =========================================================
CREATE TRIGGER trg_payroll_batches_updated_at
  BEFORE UPDATE ON public.payroll_payment_batches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_payroll_items_updated_at
  BEFORE UPDATE ON public.payroll_payment_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_wallet_balances_updated_at
  BEFORE UPDATE ON public.wallet_balances
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
