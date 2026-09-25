ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS email_from_name text,
  ADD COLUMN IF NOT EXISTS email_from_address text;