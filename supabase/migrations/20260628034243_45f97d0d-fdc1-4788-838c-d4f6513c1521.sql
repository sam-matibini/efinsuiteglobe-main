
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'invoices','bills','expenses','expense_claims','expense_claim_lines',
    'customer_payments','vendor_payments','bank_transactions','credit_card_transactions',
    'recurring_invoices','recurring_bills','purchase_orders','quotes',
    'credit_notes','vendor_credits'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format(
      'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL',
      t
    );
  END LOOP;
END $$;

-- Indexes on the high-volume tables
CREATE INDEX IF NOT EXISTS idx_invoices_org_dept ON public.invoices(organization_id, department_id);
CREATE INDEX IF NOT EXISTS idx_bills_org_dept ON public.bills(organization_id, department_id);
CREATE INDEX IF NOT EXISTS idx_expenses_org_dept ON public.expenses(organization_id, department_id);
CREATE INDEX IF NOT EXISTS idx_bank_tx_org_dept ON public.bank_transactions(department_id);
CREATE INDEX IF NOT EXISTS idx_cc_tx_org_dept ON public.credit_card_transactions(department_id);
