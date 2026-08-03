ALTER TABLE public.provincial_tax_authorities
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'tax';