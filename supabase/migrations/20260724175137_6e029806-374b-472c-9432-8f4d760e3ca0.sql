ALTER TABLE public.pay_stubs
  ADD COLUMN IF NOT EXISTS employee_mailing_address_line1 text,
  ADD COLUMN IF NOT EXISTS employee_mailing_address_line2 text,
  ADD COLUMN IF NOT EXISTS employee_mailing_city text,
  ADD COLUMN IF NOT EXISTS employee_mailing_region text,
  ADD COLUMN IF NOT EXISTS employee_mailing_postal_code text,
  ADD COLUMN IF NOT EXISTS employee_mailing_country text,
  ADD COLUMN IF NOT EXISTS employer_mailing_address_line1 text,
  ADD COLUMN IF NOT EXISTS employer_mailing_address_line2 text,
  ADD COLUMN IF NOT EXISTS employer_mailing_city text,
  ADD COLUMN IF NOT EXISTS employer_mailing_region text,
  ADD COLUMN IF NOT EXISTS employer_mailing_postal_code text,
  ADD COLUMN IF NOT EXISTS employer_mailing_country text;

COMMENT ON COLUMN public.pay_stubs.employee_mailing_address_line1 IS 'Employee mailing address snapshot line 1 captured for pay stub rendering';
COMMENT ON COLUMN public.pay_stubs.employee_mailing_address_line2 IS 'Employee mailing address snapshot line 2 captured for pay stub rendering';
COMMENT ON COLUMN public.pay_stubs.employee_mailing_city IS 'Employee mailing city snapshot captured for pay stub rendering';
COMMENT ON COLUMN public.pay_stubs.employee_mailing_region IS 'Employee mailing province/state/region snapshot captured for pay stub rendering';
COMMENT ON COLUMN public.pay_stubs.employee_mailing_postal_code IS 'Employee mailing postal or ZIP code snapshot captured for pay stub rendering';
COMMENT ON COLUMN public.pay_stubs.employee_mailing_country IS 'Employee mailing country snapshot captured for pay stub rendering';
COMMENT ON COLUMN public.pay_stubs.employer_mailing_address_line1 IS 'Employer mailing address snapshot line 1 captured for pay stub rendering';
COMMENT ON COLUMN public.pay_stubs.employer_mailing_address_line2 IS 'Employer mailing address snapshot line 2 captured for pay stub rendering';
COMMENT ON COLUMN public.pay_stubs.employer_mailing_city IS 'Employer mailing city snapshot captured for pay stub rendering';
COMMENT ON COLUMN public.pay_stubs.employer_mailing_region IS 'Employer mailing province/state/region snapshot captured for pay stub rendering';
COMMENT ON COLUMN public.pay_stubs.employer_mailing_postal_code IS 'Employer mailing postal or ZIP code snapshot captured for pay stub rendering';
COMMENT ON COLUMN public.pay_stubs.employer_mailing_country IS 'Employer mailing country snapshot captured for pay stub rendering';