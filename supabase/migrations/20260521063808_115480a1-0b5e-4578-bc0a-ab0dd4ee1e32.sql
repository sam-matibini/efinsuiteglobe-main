ALTER TABLE public.payment_links
  ADD COLUMN IF NOT EXISTS payer_name text,
  ADD COLUMN IF NOT EXISTS payer_email text;