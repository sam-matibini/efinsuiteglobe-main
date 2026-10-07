-- Contact person on a customer. Existing customers stay unchanged.
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS contact_person text;

COMMENT ON COLUMN public.customers.contact_person IS
  'Person to contact at this customer. Optional.';
