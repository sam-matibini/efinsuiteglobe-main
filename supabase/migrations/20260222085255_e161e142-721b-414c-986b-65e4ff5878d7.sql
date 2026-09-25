
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS custom_price numeric,
  ADD COLUMN IF NOT EXISTS discount_percent numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS admin_notes text;

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS invoice_interac_enabled boolean DEFAULT false;
