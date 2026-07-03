ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS invoice_ach_institution text,
  ADD COLUMN IF NOT EXISTS invoice_ach_account_name text,
  ADD COLUMN IF NOT EXISTS invoice_ach_account_number text,
  ADD COLUMN IF NOT EXISTS invoice_ach_transit_number text,
  ADD COLUMN IF NOT EXISTS invoice_etransfer_email text,
  ADD COLUMN IF NOT EXISTS invoice_cc_instructions text;