
-- Approvals
CREATE TABLE public.cra_remittance_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  tax_payment_id uuid NOT NULL REFERENCES public.tax_payments(id) ON DELETE CASCADE,
  approver_user_id uuid NOT NULL,
  level smallint NOT NULL DEFAULT 1,
  decision text NOT NULL CHECK (decision IN ('approved','rejected')),
  comment text,
  decided_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_cra_approvals_payment ON public.cra_remittance_approvals(tax_payment_id);
CREATE INDEX idx_cra_approvals_org ON public.cra_remittance_approvals(organization_id);
ALTER TABLE public.cra_remittance_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members view CRA approvals" ON public.cra_remittance_approvals
  FOR SELECT TO authenticated USING (is_org_member(organization_id, auth.uid()));
CREATE POLICY "Org members record CRA approvals" ON public.cra_remittance_approvals
  FOR INSERT TO authenticated WITH CHECK (is_org_member(organization_id, auth.uid()) AND approver_user_id = auth.uid());

-- Audit log
CREATE TABLE public.cra_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  tax_payment_id uuid REFERENCES public.tax_payments(id) ON DELETE SET NULL,
  actor_user_id uuid,
  action text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_cra_audit_org ON public.cra_audit_log(organization_id, created_at DESC);
CREATE INDEX idx_cra_audit_payment ON public.cra_audit_log(tax_payment_id);
ALTER TABLE public.cra_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members view CRA audit log" ON public.cra_audit_log
  FOR SELECT TO authenticated USING (is_org_member(organization_id, auth.uid()));
CREATE POLICY "Org members insert CRA audit log" ON public.cra_audit_log
  FOR INSERT TO authenticated WITH CHECK (is_org_member(organization_id, auth.uid()));
-- No UPDATE/DELETE policies — audit entries are immutable

-- Verified bank accounts (Plaid)
CREATE TABLE public.verified_bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  bank_account_id uuid REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
  plaid_item_id text,
  plaid_account_id text,
  institution_name text,
  account_mask text,
  account_subtype text,
  status text NOT NULL DEFAULT 'verified' CHECK (status IN ('verified','revoked','expired')),
  verified_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_verified_banks_org ON public.verified_bank_accounts(organization_id);
ALTER TABLE public.verified_bank_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members view verified banks" ON public.verified_bank_accounts
  FOR SELECT TO authenticated USING (is_org_member(organization_id, auth.uid()));
CREATE POLICY "Org members manage verified banks" ON public.verified_bank_accounts
  FOR ALL TO authenticated USING (is_org_member(organization_id, auth.uid())) WITH CHECK (is_org_member(organization_id, auth.uid()));
CREATE TRIGGER trg_verified_banks_updated BEFORE UPDATE ON public.verified_bank_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- PAD agreements
CREATE TABLE public.pad_agreements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  verified_bank_account_id uuid REFERENCES public.verified_bank_accounts(id) ON DELETE SET NULL,
  payer_name text NOT NULL,
  account_reference text,
  agreement_text text NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  ip_address text,
  signature_data text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked','expired')),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pad_org ON public.pad_agreements(organization_id);
ALTER TABLE public.pad_agreements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members view PAD agreements" ON public.pad_agreements
  FOR SELECT TO authenticated USING (is_org_member(organization_id, auth.uid()));
CREATE POLICY "Org members manage PAD agreements" ON public.pad_agreements
  FOR ALL TO authenticated USING (is_org_member(organization_id, auth.uid())) WITH CHECK (is_org_member(organization_id, auth.uid()));
CREATE TRIGGER trg_pad_agreements_updated BEFORE UPDATE ON public.pad_agreements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Approval tier helper
CREATE OR REPLACE FUNCTION public.cra_required_approvals(_amount numeric)
RETURNS smallint
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN _amount < 5000 THEN 1::smallint
    WHEN _amount < 50000 THEN 2::smallint
    ELSE 2::smallint
  END
$$;

CREATE OR REPLACE FUNCTION public.cra_remittance_can_proceed(_payment_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_amount numeric;
  v_required smallint;
  v_approved bigint;
  v_rejected bigint;
  v_needs_cfo boolean;
  v_has_cfo boolean := false;
BEGIN
  SELECT amount INTO v_amount FROM tax_payments WHERE id = _payment_id;
  IF v_amount IS NULL THEN RETURN false; END IF;
  v_required := cra_required_approvals(v_amount);
  v_needs_cfo := v_amount >= 50000;

  SELECT
    count(*) FILTER (WHERE decision = 'approved' AND approver_user_id IS NOT NULL),
    count(*) FILTER (WHERE decision = 'rejected')
  INTO v_approved, v_rejected
  FROM (
    SELECT DISTINCT ON (approver_user_id) approver_user_id, decision
    FROM cra_remittance_approvals
    WHERE tax_payment_id = _payment_id
    ORDER BY approver_user_id, decided_at DESC
  ) latest;

  IF v_rejected > 0 THEN RETURN false; END IF;

  IF v_needs_cfo THEN
    SELECT EXISTS (
      SELECT 1 FROM cra_remittance_approvals a
      JOIN user_roles r ON r.user_id = a.approver_user_id
      WHERE a.tax_payment_id = _payment_id
        AND a.decision = 'approved'
        AND r.role IN ('admin','cfo')
    ) INTO v_has_cfo;
    IF NOT v_has_cfo THEN RETURN false; END IF;
  END IF;

  RETURN v_approved >= v_required;
END
$$;
