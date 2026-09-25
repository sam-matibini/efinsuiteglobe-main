
ALTER TABLE public.departments
  ADD COLUMN IF NOT EXISTS is_shared boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS allow_postings boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS division_type text NOT NULL DEFAULT 'operating'
    CHECK (division_type IN ('operating','shared','eliminating','administration'));

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS divisions_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS default_division_id uuid REFERENCES public.departments(id);

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'journal_entries','bank_transactions','credit_card_transactions',
    'invoices','invoice_lines','bills','bill_lines',
    'expenses','expense_claims','expense_claim_lines',
    'customer_payments','vendor_payments',
    'purchase_orders','purchase_order_lines','quote_lines',
    'credit_note_lines','vendor_credit_lines',
    'recurring_invoices','recurring_invoice_lines',
    'recurring_bills','recurring_bill_lines',
    'pay_runs','pay_stubs','payroll_payment_items',
    'inventory_transactions','inventory_adjustment_lines',
    'depreciation_entries','settlements','settlement_matches'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format(
      'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.departments(id)', t);
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS idx_%I_department_id ON public.%I(department_id)', t, t);
  END LOOP;
END $$;

DO $$
DECLARE
  o RECORD;
  adm_id uuid;
  shd_id uuid;
BEGIN
  FOR o IN SELECT id FROM public.organizations LOOP
    SELECT id INTO adm_id FROM public.departments
      WHERE organization_id = o.id AND code = 'ADM' LIMIT 1;
    IF adm_id IS NULL THEN
      INSERT INTO public.departments(organization_id, code, name, division_type, allow_postings, is_active)
      VALUES (o.id, 'ADM', 'Administration', 'administration', true, true)
      RETURNING id INTO adm_id;
    END IF;

    SELECT id INTO shd_id FROM public.departments
      WHERE organization_id = o.id AND code = 'SHD' LIMIT 1;
    IF shd_id IS NULL THEN
      INSERT INTO public.departments(organization_id, code, name, division_type, is_shared, allow_postings, is_active)
      VALUES (o.id, 'SHD', 'Shared Costs', 'shared', true, true, true);
    END IF;

    UPDATE public.organizations
       SET default_division_id = adm_id
     WHERE id = o.id AND default_division_id IS NULL;
  END LOOP;
END $$;

ALTER TABLE public.bank_transactions DISABLE TRIGGER USER;
ALTER TABLE public.credit_card_transactions DISABLE TRIGGER USER;
ALTER TABLE public.journal_entries DISABLE TRIGGER USER;
ALTER TABLE public.journal_entry_lines DISABLE TRIGGER USER;
ALTER TABLE public.invoices DISABLE TRIGGER USER;
ALTER TABLE public.bills DISABLE TRIGGER USER;
ALTER TABLE public.expenses DISABLE TRIGGER USER;
ALTER TABLE public.expense_claims DISABLE TRIGGER USER;
ALTER TABLE public.customer_payments DISABLE TRIGGER USER;
ALTER TABLE public.vendor_payments DISABLE TRIGGER USER;
ALTER TABLE public.purchase_orders DISABLE TRIGGER USER;
ALTER TABLE public.recurring_invoices DISABLE TRIGGER USER;
ALTER TABLE public.recurring_bills DISABLE TRIGGER USER;
ALTER TABLE public.pay_runs DISABLE TRIGGER USER;
ALTER TABLE public.settlements DISABLE TRIGGER USER;

UPDATE public.journal_entries je SET department_id = o.default_division_id
  FROM public.organizations o WHERE je.organization_id = o.id AND je.department_id IS NULL;
UPDATE public.invoices x SET department_id = o.default_division_id
  FROM public.organizations o WHERE x.organization_id = o.id AND x.department_id IS NULL;
UPDATE public.bills x SET department_id = o.default_division_id
  FROM public.organizations o WHERE x.organization_id = o.id AND x.department_id IS NULL;
UPDATE public.expenses x SET department_id = o.default_division_id
  FROM public.organizations o WHERE x.organization_id = o.id AND x.department_id IS NULL;
UPDATE public.expense_claims x SET department_id = o.default_division_id
  FROM public.organizations o WHERE x.organization_id = o.id AND x.department_id IS NULL;
UPDATE public.customer_payments x SET department_id = o.default_division_id
  FROM public.organizations o WHERE x.organization_id = o.id AND x.department_id IS NULL;
UPDATE public.vendor_payments x SET department_id = o.default_division_id
  FROM public.organizations o WHERE x.organization_id = o.id AND x.department_id IS NULL;
UPDATE public.purchase_orders x SET department_id = o.default_division_id
  FROM public.organizations o WHERE x.organization_id = o.id AND x.department_id IS NULL;
UPDATE public.recurring_invoices x SET department_id = o.default_division_id
  FROM public.organizations o WHERE x.organization_id = o.id AND x.department_id IS NULL;
UPDATE public.recurring_bills x SET department_id = o.default_division_id
  FROM public.organizations o WHERE x.organization_id = o.id AND x.department_id IS NULL;
UPDATE public.pay_runs x SET department_id = o.default_division_id
  FROM public.organizations o WHERE x.organization_id = o.id AND x.department_id IS NULL;
UPDATE public.settlements x SET department_id = o.default_division_id
  FROM public.organizations o WHERE x.organization_id = o.id AND x.department_id IS NULL;

UPDATE public.bank_transactions bt SET department_id = o.default_division_id
  FROM public.bank_accounts ba
  JOIN public.organizations o ON o.id = ba.organization_id
  WHERE bt.bank_account_id = ba.id AND bt.department_id IS NULL;

UPDATE public.credit_card_transactions ct SET department_id = o.default_division_id
  FROM public.credit_cards cc
  JOIN public.organizations o ON o.id = cc.organization_id
  WHERE ct.credit_card_id = cc.id AND ct.department_id IS NULL;

UPDATE public.journal_entry_lines jel SET department_id = je.department_id
  FROM public.journal_entries je
  WHERE jel.journal_entry_id = je.id AND jel.department_id IS NULL AND je.department_id IS NOT NULL;

ALTER TABLE public.bank_transactions ENABLE TRIGGER USER;
ALTER TABLE public.credit_card_transactions ENABLE TRIGGER USER;
ALTER TABLE public.journal_entries ENABLE TRIGGER USER;
ALTER TABLE public.journal_entry_lines ENABLE TRIGGER USER;
ALTER TABLE public.invoices ENABLE TRIGGER USER;
ALTER TABLE public.bills ENABLE TRIGGER USER;
ALTER TABLE public.expenses ENABLE TRIGGER USER;
ALTER TABLE public.expense_claims ENABLE TRIGGER USER;
ALTER TABLE public.customer_payments ENABLE TRIGGER USER;
ALTER TABLE public.vendor_payments ENABLE TRIGGER USER;
ALTER TABLE public.purchase_orders ENABLE TRIGGER USER;
ALTER TABLE public.recurring_invoices ENABLE TRIGGER USER;
ALTER TABLE public.recurring_bills ENABLE TRIGGER USER;
ALTER TABLE public.pay_runs ENABLE TRIGGER USER;
ALTER TABLE public.settlements ENABLE TRIGGER USER;

ALTER TABLE public.transaction_rules
  ADD COLUMN IF NOT EXISTS set_department_id uuid REFERENCES public.departments(id);

CREATE OR REPLACE FUNCTION public.log_division_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND COALESCE(OLD.department_id::text,'') <> COALESCE(NEW.department_id::text,'') THEN
    BEGIN
      INSERT INTO public.audit_logs(
        organization_id, user_id, action, entity_type, entity_id, old_values, new_values
      ) VALUES (
        COALESCE(NEW.organization_id, OLD.organization_id),
        auth.uid(),
        'division_changed',
        TG_TABLE_NAME,
        NEW.id,
        jsonb_build_object('department_id', OLD.department_id),
        jsonb_build_object('department_id', NEW.department_id)
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;
  RETURN NEW;
END $$;

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'journal_entries','invoices','bills','expenses','expense_claims',
    'bank_transactions','credit_card_transactions'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_log_division_change_%I ON public.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER trg_log_division_change_%I
         AFTER UPDATE OF department_id ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.log_division_change()', t, t);
  END LOOP;
END $$;

CREATE TABLE IF NOT EXISTS public.user_division_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  access_level text NOT NULL DEFAULT 'view'
    CHECK (access_level IN ('view','post','approve')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, department_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_division_access TO authenticated;
GRANT ALL ON public.user_division_access TO service_role;

ALTER TABLE public.user_division_access ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members can view division access" ON public.user_division_access;
CREATE POLICY "Org members can view division access"
  ON public.user_division_access FOR SELECT
  TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));

DROP POLICY IF EXISTS "Org admins can manage division access" ON public.user_division_access;
CREATE POLICY "Org admins can manage division access"
  ON public.user_division_access FOR ALL
  TO authenticated
  USING (public.is_org_admin_or_owner(organization_id, auth.uid()))
  WITH CHECK (public.is_org_admin_or_owner(organization_id, auth.uid()));

CREATE OR REPLACE FUNCTION public.has_division_access(
  _user_id uuid, _department_id uuid, _level text DEFAULT 'view'
) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH dept AS (
    SELECT organization_id FROM public.departments WHERE id = _department_id
  ),
  grants AS (
    SELECT access_level FROM public.user_division_access
    WHERE user_id = _user_id AND department_id = _department_id
  ),
  any_grants AS (
    SELECT 1 FROM public.user_division_access uda
    JOIN dept d ON d.organization_id = uda.organization_id
    WHERE uda.user_id = _user_id
    LIMIT 1
  )
  SELECT
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM any_grants) THEN true
      WHEN _level = 'view'    THEN EXISTS (SELECT 1 FROM grants)
      WHEN _level = 'post'    THEN EXISTS (SELECT 1 FROM grants WHERE access_level IN ('post','approve'))
      WHEN _level = 'approve' THEN EXISTS (SELECT 1 FROM grants WHERE access_level = 'approve')
      ELSE false
    END
$$;

DROP TRIGGER IF EXISTS trg_user_division_access_updated_at ON public.user_division_access;
CREATE TRIGGER trg_user_division_access_updated_at
  BEFORE UPDATE ON public.user_division_access
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
