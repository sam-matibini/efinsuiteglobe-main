-- Retail sales taxes paid: ITC / Input VAT / PST Paid / Use Tax
-- Adds direction on document tax rows, VAT paid/collected GL accounts,
-- claim flags, and paid-side labels on country tax-code seeds.

-- ---------------------------------------------------------------------------
-- Document tax rows: collected (sales) vs paid (purchases)
-- ---------------------------------------------------------------------------
ALTER TABLE public.invoice_taxes
  ADD COLUMN IF NOT EXISTS tax_direction text NOT NULL DEFAULT 'collected';

ALTER TABLE public.bill_taxes
  ADD COLUMN IF NOT EXISTS tax_direction text NOT NULL DEFAULT 'paid';

ALTER TABLE public.expense_taxes
  ADD COLUMN IF NOT EXISTS tax_direction text NOT NULL DEFAULT 'paid';

ALTER TABLE public.invoice_taxes
  DROP CONSTRAINT IF EXISTS invoice_taxes_tax_direction_check;
ALTER TABLE public.invoice_taxes
  ADD CONSTRAINT invoice_taxes_tax_direction_check
  CHECK (tax_direction IN ('collected', 'paid'));

ALTER TABLE public.bill_taxes
  DROP CONSTRAINT IF EXISTS bill_taxes_tax_direction_check;
ALTER TABLE public.bill_taxes
  ADD CONSTRAINT bill_taxes_tax_direction_check
  CHECK (tax_direction IN ('collected', 'paid'));

ALTER TABLE public.expense_taxes
  DROP CONSTRAINT IF EXISTS expense_taxes_tax_direction_check;
ALTER TABLE public.expense_taxes
  ADD CONSTRAINT expense_taxes_tax_direction_check
  CHECK (tax_direction IN ('collected', 'paid'));

COMMENT ON COLUMN public.invoice_taxes.tax_direction IS
  'collected = output/retail tax charged on sales; paid = input tax (rare on invoices, e.g. credit notes)';
COMMENT ON COLUMN public.bill_taxes.tax_direction IS
  'paid = GST/HST ITC, Input VAT, PST paid, or use tax on purchases';
COMMENT ON COLUMN public.expense_taxes.tax_direction IS
  'paid = GST/HST ITC, Input VAT, PST paid, or use tax on expenses';

CREATE INDEX IF NOT EXISTS idx_invoice_taxes_direction
  ON public.invoice_taxes (tax_direction);
CREATE INDEX IF NOT EXISTS idx_bill_taxes_direction
  ON public.bill_taxes (tax_direction);
CREATE INDEX IF NOT EXISTS idx_expense_taxes_direction
  ON public.expense_taxes (tax_direction);

-- ---------------------------------------------------------------------------
-- sales_tax_settings: VAT GL accounts + input-tax claim flags
-- ---------------------------------------------------------------------------
ALTER TABLE public.sales_tax_settings
  ADD COLUMN IF NOT EXISTS vat_collected_account_id uuid REFERENCES public.accounts(id),
  ADD COLUMN IF NOT EXISTS vat_paid_account_id uuid REFERENCES public.accounts(id),
  ADD COLUMN IF NOT EXISTS claim_input_tax boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS claim_gst_hst_itc boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS claim_pst_paid boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.sales_tax_settings.vat_collected_account_id IS
  'Output VAT / IVA / TVA collected on sales (liability)';
COMMENT ON COLUMN public.sales_tax_settings.vat_paid_account_id IS
  'Input VAT / IVA / TVA paid on purchases (asset / recoverable)';
COMMENT ON COLUMN public.sales_tax_settings.claim_input_tax IS
  'When true, recoverable retail taxes paid on purchases are posted to the ITC/Input VAT asset account';
COMMENT ON COLUMN public.sales_tax_settings.claim_gst_hst_itc IS
  'Canada: claim GST/HST Input Tax Credits on purchases';
COMMENT ON COLUMN public.sales_tax_settings.claim_pst_paid IS
  'Canada: track PST paid on purchases (non-recoverable except QST ITR)';

-- Existing orgs that already collect VAT should reuse the GST paid/collected
-- accounts as VAT accounts until they map dedicated ones.
UPDATE public.sales_tax_settings
SET
  vat_collected_account_id = COALESCE(vat_collected_account_id, gst_collected_account_id),
  vat_paid_account_id = COALESCE(vat_paid_account_id, gst_paid_account_id)
WHERE collect_vat IS TRUE
  AND (vat_collected_account_id IS NULL OR vat_paid_account_id IS NULL);

-- ---------------------------------------------------------------------------
-- country_tax_code_seeds: paid-side display name
-- ---------------------------------------------------------------------------
ALTER TABLE public.country_tax_code_seeds
  ADD COLUMN IF NOT EXISTS paid_name text;

UPDATE public.country_tax_code_seeds SET paid_name = CASE
  WHEN code IN ('GST') THEN 'GST Paid (ITC)'
  WHEN code IN ('HST') THEN 'HST Paid (ITC)'
  WHEN code IN ('PST') THEN 'PST Paid'
  WHEN code IN ('QST') THEN 'QST Paid (ITR)'
  WHEN code IN ('SALES_TAX') THEN 'Sales Tax Paid / Use Tax'
  WHEN code IN ('USE_TAX') THEN 'Use Tax Paid'
  WHEN code IN ('SST') THEN 'SST Paid'
  WHEN code IN ('CGST') THEN 'CGST Paid (ITC)'
  WHEN code IN ('SGST') THEN 'SGST Paid (ITC)'
  WHEN code IN ('IGST') THEN 'IGST Paid (ITC)'
  WHEN code IN ('VAT', 'VAT_STD', 'VAT_RED', 'VAT_ZERO') THEN
    CASE country_code
      WHEN 'DE' THEN 'USt Paid (Vorsteuer)'
      WHEN 'AT' THEN 'USt Paid (Vorsteuer)'
      WHEN 'FR' THEN 'TVA Paid (Input TVA)'
      WHEN 'BE' THEN 'TVA Paid (Input TVA)'
      WHEN 'RO' THEN 'TVA Paid (Input TVA)'
      WHEN 'IT' THEN 'IVA Paid (Input IVA)'
      WHEN 'ES' THEN 'IVA Paid (Input IVA)'
      WHEN 'PT' THEN 'IVA Paid (Input IVA)'
      WHEN 'NL' THEN 'BTW Paid (Voorbelasting)'
      WHEN 'CH' THEN 'MWST Paid (Vorsteuer)'
      WHEN 'CZ' THEN 'DPH Paid (Input VAT)'
      WHEN 'SE' THEN 'Moms Paid (Input VAT)'
      WHEN 'DK' THEN 'Moms Paid (Input VAT)'
      WHEN 'NO' THEN 'MVA Paid (Input VAT)'
      WHEN 'FI' THEN 'ALV Paid (Input VAT)'
      WHEN 'HU' THEN 'AFA Paid (Input AFA)'
      WHEN 'HR' THEN 'PDV Paid (Input VAT)'
      WHEN 'UA' THEN 'PDV Paid (Input VAT)'
      ELSE 'VAT Paid (Input VAT)'
    END
  WHEN code IN ('IVA') THEN 'IVA Paid (Input IVA)'
  WHEN code IN ('IGV') THEN 'IGV Paid (Input IGV)'
  WHEN code IN ('ICMS') THEN 'ICMS Paid (Input ICMS)'
  WHEN code IN ('PPN') THEN 'PPN Paid (Input PPN)'
  WHEN code IN ('KDV') THEN 'KDV Paid (Input KDV)'
  WHEN code IN ('CT') THEN 'Consumption Tax Paid (Input)'
  WHEN code IN ('EXEMPT', 'ZR-EXP', 'GST_FREE', 'GST_ZERO') THEN 'No input tax'
  ELSE COALESCE(paid_name, name || ' Paid')
END
WHERE paid_name IS NULL;

COMMENT ON COLUMN public.country_tax_code_seeds.paid_name IS
  'Localized label for the purchase-side (ITC / Input VAT / PST Paid) posting of this tax code';
