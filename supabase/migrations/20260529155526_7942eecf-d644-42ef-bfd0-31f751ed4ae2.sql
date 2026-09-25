ALTER TABLE public.pad_agreements
  ADD COLUMN IF NOT EXISTS payer_email text,
  ADD COLUMN IF NOT EXISTS payer_title text,
  ADD COLUMN IF NOT EXISTS signature_text text;