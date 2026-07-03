-- Add columns to invoices for signatures and custom fields
ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS seller_signature_id UUID REFERENCES public.user_signatures(id),
ADD COLUMN IF NOT EXISTS buyer_signature_data TEXT,
ADD COLUMN IF NOT EXISTS buyer_signature_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS buyer_name TEXT,
ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS document_title TEXT DEFAULT 'Invoice',
ADD COLUMN IF NOT EXISTS vehicle_info JSONB,
ADD COLUMN IF NOT EXISTS inventory_item_ids UUID[];

-- Add index for custom fields search
CREATE INDEX IF NOT EXISTS idx_invoices_custom_fields ON public.invoices USING GIN (custom_fields);

-- Add comments for documentation
COMMENT ON COLUMN public.invoices.seller_signature_id IS 'Reference to seller/organization signature';
COMMENT ON COLUMN public.invoices.buyer_signature_data IS 'Base64 encoded buyer signature';
COMMENT ON COLUMN public.invoices.buyer_name IS 'Name of buyer/signer';
COMMENT ON COLUMN public.invoices.custom_fields IS 'JSON array of custom field objects with label, value, and type';
COMMENT ON COLUMN public.invoices.document_title IS 'Custom document title (e.g., Bill of Sale, Receipt)';
COMMENT ON COLUMN public.invoices.vehicle_info IS 'Vehicle information for Bill of Sale (VIN, make, model, year, color, odometer)';
COMMENT ON COLUMN public.invoices.inventory_item_ids IS 'Array of inventory item IDs linked to this invoice';