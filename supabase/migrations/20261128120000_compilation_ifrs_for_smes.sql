-- Allow IFRS for SMEs as a compilation framework (Nigeria: SMEs report under the IFRS for SMEs
-- Accounting Standard; public interest entities use full IFRS - FRC of Nigeria Act 2011, as amended).
ALTER TABLE public.compilation_reports DROP CONSTRAINT IF EXISTS compilation_reports_accounting_framework_check;
ALTER TABLE public.compilation_reports ADD CONSTRAINT compilation_reports_accounting_framework_check
  CHECK (accounting_framework = ANY (ARRAY['ASPE'::text, 'IFRS'::text, 'IFRS_SME'::text, 'ASNPO'::text]));
