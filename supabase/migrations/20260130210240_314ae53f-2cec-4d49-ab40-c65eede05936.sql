-- Add missing columns to sales_tax_settings for US and UK tax support
ALTER TABLE public.sales_tax_settings 
ADD COLUMN IF NOT EXISTS collect_sales_tax boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS sales_tax_rate numeric(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS collect_vat boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS vat_rate numeric(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS vat_number text;