
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS receipt_show_logo boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS receipt_logo_url text,
  ADD COLUMN IF NOT EXISTS payroll_show_logo boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS payroll_logo_url text,
  ADD COLUMN IF NOT EXISTS statement_show_logo boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS statement_logo_url text;

COMMENT ON COLUMN organizations.receipt_show_logo IS 'Show logo on donation receipts';
COMMENT ON COLUMN organizations.receipt_logo_url IS 'Optional override logo for donation receipts';
COMMENT ON COLUMN organizations.payroll_show_logo IS 'Show logo on pay stubs and payroll reports';
COMMENT ON COLUMN organizations.payroll_logo_url IS 'Optional override logo for payroll documents';
COMMENT ON COLUMN organizations.statement_show_logo IS 'Show logo on financial statements (BS, IS, TB, etc.)';
COMMENT ON COLUMN organizations.statement_logo_url IS 'Optional override logo for financial statements';
