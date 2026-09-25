-- Enhanced compilation_reports table for CSRS 4200 compliance
-- Add new columns for comprehensive compilation engagement tracking

ALTER TABLE public.compilation_reports 
ADD COLUMN IF NOT EXISTS report_type TEXT DEFAULT 'compilation',
ADD COLUMN IF NOT EXISTS reporting_period_type TEXT DEFAULT 'annual',
ADD COLUMN IF NOT EXISTS period_start_date TEXT,
ADD COLUMN IF NOT EXISTS engagement_letter_date TEXT,
ADD COLUMN IF NOT EXISTS management_responsibility_acknowledged BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS firm_name TEXT,
ADD COLUMN IF NOT EXISTS firm_address TEXT,
ADD COLUMN IF NOT EXISTS client_address TEXT,
ADD COLUMN IF NOT EXISTS preparer_license_number TEXT,
ADD COLUMN IF NOT EXISTS statement_types JSONB DEFAULT '["balance_sheet", "income_statement", "retained_earnings", "cash_flow"]'::jsonb,
ADD COLUMN IF NOT EXISTS comparative_period_end TEXT,
ADD COLUMN IF NOT EXISTS basis_of_accounting TEXT DEFAULT 'ASPE',
ADD COLUMN IF NOT EXISTS restriction_notice TEXT,
ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'CAD';

-- Add comment for documentation
COMMENT ON COLUMN public.compilation_reports.report_type IS 'Type of engagement: compilation, review, audit';
COMMENT ON COLUMN public.compilation_reports.reporting_period_type IS 'Period type: annual, interim, quarterly';
COMMENT ON COLUMN public.compilation_reports.period_start_date IS 'Start date of reporting period';
COMMENT ON COLUMN public.compilation_reports.basis_of_accounting IS 'Accounting framework: ASPE, IFRS, GAAP';
COMMENT ON COLUMN public.compilation_reports.statement_types IS 'Array of statement types included in report';