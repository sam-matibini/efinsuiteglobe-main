-- Ensure GST/HST ITC / Input VAT columns exist on hosted sales_tax_settings
-- even if 20260823200000 was not applied, then reload the PostgREST schema cache.

ALTER TABLE public.sales_tax_settings
  ADD COLUMN IF NOT EXISTS vat_collected_account_id uuid REFERENCES public.accounts(id),
  ADD COLUMN IF NOT EXISTS vat_paid_account_id uuid REFERENCES public.accounts(id),
  ADD COLUMN IF NOT EXISTS claim_input_tax boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS claim_gst_hst_itc boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS claim_pst_paid boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.sales_tax_settings.claim_gst_hst_itc IS
  'Canada: claim GST/HST Input Tax Credits on purchases';
COMMENT ON COLUMN public.sales_tax_settings.claim_input_tax IS
  'When true, recoverable retail taxes paid on purchases are posted to the ITC/Input VAT asset account';
COMMENT ON COLUMN public.sales_tax_settings.claim_pst_paid IS
  'Canada: track PST paid on purchases (non-recoverable except QST ITR)';

ALTER TABLE public.tax_codes
  ADD COLUMN IF NOT EXISTS applies_to text NOT NULL DEFAULT 'both',
  ADD COLUMN IF NOT EXISTS paid_name text;

ALTER TABLE public.invoice_taxes
  ADD COLUMN IF NOT EXISTS tax_direction text NOT NULL DEFAULT 'collected';
ALTER TABLE public.bill_taxes
  ADD COLUMN IF NOT EXISTS tax_direction text NOT NULL DEFAULT 'paid';
ALTER TABLE public.expense_taxes
  ADD COLUMN IF NOT EXISTS tax_direction text NOT NULL DEFAULT 'paid';

NOTIFY pgrst, 'reload schema';
