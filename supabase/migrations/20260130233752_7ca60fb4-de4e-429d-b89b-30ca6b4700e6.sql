-- Add missing sales_tax_number column for US-style tax registration
ALTER TABLE public.sales_tax_settings
ADD COLUMN IF NOT EXISTS sales_tax_number TEXT DEFAULT NULL;

COMMENT ON COLUMN public.sales_tax_settings.sales_tax_number IS 'US-style sales tax permit/registration number';