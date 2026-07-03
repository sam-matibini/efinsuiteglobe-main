-- Add payroll account number to organizations (e.g., CRA RP account: 123456789RP0001)
ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS payroll_account_number TEXT;

COMMENT ON COLUMN public.organizations.payroll_account_number IS 'Payroll account number (e.g., CRA RP0001, IRS EIN) used on T4/W-2 slips and remittances';