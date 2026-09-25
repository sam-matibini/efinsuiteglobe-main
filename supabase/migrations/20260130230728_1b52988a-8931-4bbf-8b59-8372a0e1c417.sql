-- Add contact and tax registration fields to organizations
ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS dealer_permit_number TEXT,
ADD COLUMN IF NOT EXISTS gst_hst_number TEXT,
ADD COLUMN IF NOT EXISTS pst_number TEXT;

-- Add contact, tax registration, and split tax fields to invoices
ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS seller_email TEXT,
ADD COLUMN IF NOT EXISTS seller_phone TEXT,
ADD COLUMN IF NOT EXISTS buyer_email TEXT,
ADD COLUMN IF NOT EXISTS buyer_phone TEXT,
ADD COLUMN IF NOT EXISTS dealer_permit_number TEXT,
ADD COLUMN IF NOT EXISTS gst_hst_number TEXT,
ADD COLUMN IF NOT EXISTS pst_number TEXT,
ADD COLUMN IF NOT EXISTS gst_hst_amount NUMERIC(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS pst_amount NUMERIC(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_gst_hst_exempt BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_pst_exempt BOOLEAN DEFAULT false;

-- Create indexes for common lookups
CREATE INDEX IF NOT EXISTS idx_invoices_gst_hst_exempt ON public.invoices(is_gst_hst_exempt) WHERE is_gst_hst_exempt = true;
CREATE INDEX IF NOT EXISTS idx_invoices_pst_exempt ON public.invoices(is_pst_exempt) WHERE is_pst_exempt = true;

-- Add comment for documentation
COMMENT ON COLUMN public.invoices.is_gst_hst_exempt IS 'When true, GST/HST is excluded (e.g., export sales)';
COMMENT ON COLUMN public.invoices.is_pst_exempt IS 'When true, PST is excluded from the invoice';
COMMENT ON COLUMN public.organizations.dealer_permit_number IS 'Dealer or business permit number for regulated industries';
COMMENT ON COLUMN public.organizations.gst_hst_number IS 'GST/HST registration number for Canadian businesses';
COMMENT ON COLUMN public.organizations.pst_number IS 'PST registration number for provincial sales tax';

-- Update print_templates with tax registration display config
UPDATE public.print_templates
SET body_template = COALESCE(body_template, '{}'::jsonb) || jsonb_build_object(
  'show_dealer_permit', true,
  'show_gst_hst_number', true,
  'show_pst_number', true,
  'show_seller_contact', true,
  'show_buyer_contact', true,
  'split_tax_display', true,
  'show_tax_exemptions', true
)
WHERE document_type = 'invoice'::print_document_type;