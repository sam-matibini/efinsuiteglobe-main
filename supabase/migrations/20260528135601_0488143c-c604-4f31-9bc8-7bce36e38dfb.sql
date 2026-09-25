
-- 1) CRA payee catalogue --------------------------------------------------------
CREATE TABLE public.cra_payee_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_code text NOT NULL UNIQUE,
  payment_type text NOT NULL,
  display_label text NOT NULL,
  cra_bill_payee_code text,
  remittance_voucher_form text,
  due_date_rule jsonb NOT NULL DEFAULT '{}'::jsonb,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.cra_payee_catalog TO anon;
GRANT SELECT ON public.cra_payee_catalog TO authenticated;
GRANT ALL ON public.cra_payee_catalog TO service_role;

ALTER TABLE public.cra_payee_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Catalog readable by everyone"
  ON public.cra_payee_catalog FOR SELECT
  USING (true);

INSERT INTO public.cra_payee_catalog
  (program_code, payment_type, display_label, cra_bill_payee_code, remittance_voucher_form, due_date_rule, description, sort_order)
VALUES
  ('RP', 'source_deductions',          'Payroll Source Deductions (RP)',  'CRA (REVENUE) - PAYROLL & SOURCE DEDUCTIONS',     'PD7A',  '{"cadence":"monthly","day":15,"lag_days":15}'::jsonb,  'Federal & provincial tax, CPP and EI withheld from employee pay.', 10),
  ('RT', 'gst_hst',                    'GST / HST (RT)',                  'CRA (REVENUE) - TAX OWING',                       'GST34', '{"cadence":"quarterly","lag_days":30}'::jsonb,         'Goods and Services Tax / Harmonized Sales Tax remittance.',        20),
  ('RC', 'corporate_tax',              'Corporate Income Tax (RC)',       'CRA (REVENUE) - CORPORATION TAX',                 'RC159', '{"cadence":"monthly","lag_days":30}'::jsonb,           'T2 corporate income tax installments and balance owing.',          30),
  ('RC_INSTALLMENT', 'installment',    'Corporate Tax Installments',      'CRA (REVENUE) - CORPORATION TAX INSTALMENTS',     'RC160', '{"cadence":"monthly","day":-1,"lag_days":0}'::jsonb,   'Monthly or quarterly T2 instalments under s.157.',                 35),
  ('RE', 'excise',                     'Excise Tax / Duty (RE)',          'CRA (REVENUE) - EXCISE TAX',                      'B249',  '{"cadence":"monthly","lag_days":30}'::jsonb,           'Federal excise tax and duty.',                                     40),
  ('NR', 'non_resident_withholding',   'Non-Resident Withholding (NR)',   'CRA (REVENUE) - NON-RESIDENT TAX',                'NR76',  '{"cadence":"monthly","day":15,"lag_days":0}'::jsonb,   'Part XIII withholding tax on payments to non-residents.',          50),
  ('RZ', 't4_balance',                 'T4 / T4A Balance Owing (RZ)',     'CRA (REVENUE) - INFORMATION RETURNS',             'T7DRA', '{"cadence":"annual","day":-1,"lag_days":60}'::jsonb,   'Year-end T4 / T4A summary balance owing.',                         60);

CREATE TRIGGER update_cra_payee_catalog_updated_at
  BEFORE UPDATE ON public.cra_payee_catalog
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Extend existing pad_agreements -----------------------------------------------
ALTER TABLE public.pad_agreements
  ADD COLUMN IF NOT EXISTS bank_account_id uuid REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS max_amount_per_debit numeric(14,2),
  ADD COLUMN IF NOT EXISTS max_amount_per_period numeric(14,2),
  ADD COLUMN IF NOT EXISTS frequency text DEFAULT 'sporadic' CHECK (frequency IN ('sporadic','recurring')),
  ADD COLUMN IF NOT EXISTS cra_program_account_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS cra_pad_number text,
  ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'general' CHECK (scope IN ('general','cra')),
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz,
  ADD COLUMN IF NOT EXISTS revoked_reason text;

CREATE INDEX IF NOT EXISTS idx_pad_agreements_org_scope_status
  ON public.pad_agreements(organization_id, scope, status);

-- 3) Reconciliation source on tax_payments ---------------------------------------
ALTER TABLE public.tax_payments
  ADD COLUMN IF NOT EXISTS reconciliation_source text
    CHECK (reconciliation_source IN ('manual','webhook','bank_feed','scheduler'));
