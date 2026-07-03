
-- ============================================================
-- Phase 3 — Enterprise Treasury
-- ============================================================

-- 1) cra_payment_batches
CREATE TABLE public.cra_payment_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  reference text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  program_code text NOT NULL,
  total_amount numeric(14,2) NOT NULL DEFAULT 0,
  item_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','pending_approval','approved','submitted','completed','failed','cancelled')),
  bank_account_id uuid REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
  pad_agreement_id uuid REFERENCES public.pad_agreements(id) ON DELETE SET NULL,
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  submitted_at timestamptz,
  completed_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, reference)
);
CREATE INDEX idx_cra_batches_org_status ON public.cra_payment_batches(organization_id, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cra_payment_batches TO authenticated;
GRANT ALL ON public.cra_payment_batches TO service_role;
ALTER TABLE public.cra_payment_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members view CRA batches" ON public.cra_payment_batches
  FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org admins manage CRA batches" ON public.cra_payment_batches
  FOR ALL TO authenticated
  USING (public.is_org_admin_or_owner(organization_id, auth.uid()))
  WITH CHECK (public.is_org_admin_or_owner(organization_id, auth.uid()));

-- 2) cra_payment_batch_items
CREATE TABLE public.cra_payment_batch_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.cra_payment_batches(id) ON DELETE CASCADE,
  tax_payment_id uuid REFERENCES public.tax_payments(id) ON DELETE SET NULL,
  pay_run_id uuid REFERENCES public.pay_runs(id) ON DELETE SET NULL,
  amount numeric(14,2) NOT NULL,
  employee_count integer,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','submitted','completed','failed','cancelled')),
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_cra_batch_items_batch ON public.cra_payment_batch_items(batch_id);
CREATE INDEX idx_cra_batch_items_payment ON public.cra_payment_batch_items(tax_payment_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cra_payment_batch_items TO authenticated;
GRANT ALL ON public.cra_payment_batch_items TO service_role;
ALTER TABLE public.cra_payment_batch_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members view batch items" ON public.cra_payment_batch_items
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.cra_payment_batches b
    WHERE b.id = batch_id AND public.is_org_member(auth.uid(), b.organization_id)
  ));
CREATE POLICY "Org admins manage batch items" ON public.cra_payment_batch_items
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.cra_payment_batches b
    WHERE b.id = batch_id AND public.is_org_admin_or_owner(b.organization_id, auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.cra_payment_batches b
    WHERE b.id = batch_id AND public.is_org_admin_or_owner(b.organization_id, auth.uid())
  ));

-- Trigger to keep batch totals in sync
CREATE OR REPLACE FUNCTION public.fn_sync_cra_batch_totals()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  bid uuid;
BEGIN
  bid := COALESCE(NEW.batch_id, OLD.batch_id);
  UPDATE public.cra_payment_batches
  SET
    total_amount = COALESCE((SELECT SUM(amount) FROM public.cra_payment_batch_items WHERE batch_id = bid), 0),
    item_count = COALESCE((SELECT COUNT(*) FROM public.cra_payment_batch_items WHERE batch_id = bid), 0),
    updated_at = now()
  WHERE id = bid;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_sync_cra_batch_totals
AFTER INSERT OR UPDATE OR DELETE ON public.cra_payment_batch_items
FOR EACH ROW EXECUTE FUNCTION public.fn_sync_cra_batch_totals();

-- 3) cra_approval_rules
CREATE TABLE public.cra_approval_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  min_amount numeric(14,2) NOT NULL DEFAULT 0,
  max_amount numeric(14,2),
  required_role text NOT NULL DEFAULT 'admin',
  required_approver_count integer NOT NULL DEFAULT 1 CHECK (required_approver_count >= 1),
  program_codes text[] NOT NULL DEFAULT '{}'::text[],
  priority integer NOT NULL DEFAULT 100,
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_cra_approval_rules_org ON public.cra_approval_rules(organization_id, active);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cra_approval_rules TO authenticated;
GRANT ALL ON public.cra_approval_rules TO service_role;
ALTER TABLE public.cra_approval_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members view approval rules" ON public.cra_approval_rules
  FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org admins manage approval rules" ON public.cra_approval_rules
  FOR ALL TO authenticated
  USING (public.is_org_admin_or_owner(organization_id, auth.uid()))
  WITH CHECK (public.is_org_admin_or_owner(organization_id, auth.uid()));

-- 4) accountant_delegations
CREATE TABLE public.accountant_delegations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  delegated_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  scope jsonb NOT NULL DEFAULT '{"treasury":true,"payroll_remit":true,"approve":false}'::jsonb,
  notes text,
  expires_at timestamptz,
  revoked_at timestamptz,
  revoked_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_accountant_delegations_org ON public.accountant_delegations(organization_id);
CREATE INDEX idx_accountant_delegations_user ON public.accountant_delegations(delegated_user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.accountant_delegations TO authenticated;
GRANT ALL ON public.accountant_delegations TO service_role;
ALTER TABLE public.accountant_delegations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org admins manage delegations" ON public.accountant_delegations
  FOR ALL TO authenticated
  USING (public.is_org_admin_or_owner(organization_id, auth.uid()))
  WITH CHECK (public.is_org_admin_or_owner(organization_id, auth.uid()));
CREATE POLICY "Delegated user views own delegation" ON public.accountant_delegations
  FOR SELECT TO authenticated
  USING (delegated_user_id = auth.uid());

-- 5) RPC has_treasury_delegation
CREATE OR REPLACE FUNCTION public.has_treasury_delegation(
  _user_id uuid,
  _org_id uuid,
  _capability text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.accountant_delegations d
    WHERE d.delegated_user_id = _user_id
      AND d.organization_id = _org_id
      AND d.revoked_at IS NULL
      AND (d.expires_at IS NULL OR d.expires_at > now())
      AND COALESCE((d.scope ->> _capability)::boolean, false) = true
  );
$$;

-- 6) cra_remittance_summary view (security_invoker = true)
CREATE OR REPLACE VIEW public.cra_remittance_summary
WITH (security_invoker = true) AS
SELECT
  tp.organization_id,
  COUNT(*) FILTER (WHERE tp.status IN ('draft','pending','scheduled')) AS pending_count,
  COALESCE(SUM(tp.amount) FILTER (WHERE tp.status IN ('draft','pending','scheduled')), 0) AS pending_amount,
  COUNT(*) FILTER (WHERE tp.status = 'processing') AS processing_count,
  COALESCE(SUM(tp.amount) FILTER (WHERE tp.status = 'processing'), 0) AS processing_amount,
  COUNT(*) FILTER (WHERE tp.status IN ('paid','completed')) AS completed_count,
  MAX(tp.paid_at) AS last_paid_at,
  MAX(tp.created_at) AS last_activity_at
FROM public.tax_payments tp
GROUP BY tp.organization_id;

GRANT SELECT ON public.cra_remittance_summary TO authenticated;
