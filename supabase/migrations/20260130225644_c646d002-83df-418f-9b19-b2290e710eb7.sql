-- Add buyer address fields to invoices table
ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS buyer_address_line1 TEXT,
ADD COLUMN IF NOT EXISTS buyer_address_line2 TEXT,
ADD COLUMN IF NOT EXISTS buyer_city TEXT,
ADD COLUMN IF NOT EXISTS buyer_province TEXT,
ADD COLUMN IF NOT EXISTS buyer_postal_code TEXT,
ADD COLUMN IF NOT EXISTS buyer_country TEXT;

-- Add indexes for reporting
CREATE INDEX IF NOT EXISTS idx_invoices_buyer_city ON public.invoices(buyer_city);
CREATE INDEX IF NOT EXISTS idx_invoices_buyer_country ON public.invoices(buyer_country);

-- Update print_templates with address placeholders in header/footer templates
UPDATE public.print_templates
SET 
  header_template = jsonb_build_object(
    'show_seller_address', true,
    'show_buyer_address', true,
    'address_format', CASE 
      WHEN default_language IN ('en', 'fr') AND paper_size = 'letter' THEN 'north_american'
      WHEN default_language IN ('de', 'fr', 'it', 'es', 'nl') THEN 'european'
      WHEN default_language IN ('ja', 'zh', 'ko') THEN 'asian'
      ELSE 'international'
    END
  ),
  body_template = jsonb_build_object(
    'include_addresses', true,
    'address_position', 'top'
  )
WHERE document_type = 'invoice'::print_document_type 
  AND code LIKE 'INV_BASE_%';