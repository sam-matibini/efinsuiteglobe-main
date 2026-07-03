
-- Add mailing_province to employees for separate mailing address province
-- The existing 'province' column remains as province of employment
ALTER TABLE public.employees ADD COLUMN mailing_province text;

-- Comment for clarity
COMMENT ON COLUMN public.employees.province IS 'Province/state of employment (for tax purposes, typically matches employer/org province)';
COMMENT ON COLUMN public.employees.mailing_province IS 'Province/state of employee mailing address (may differ from employment province for remote workers)';
