-- Add document_type column to invoice_custom_field_templates to support different document types
ALTER TABLE public.invoice_custom_field_templates
ADD COLUMN IF NOT EXISTS document_type TEXT DEFAULT 'all';

-- Create index for faster lookups by document type
CREATE INDEX IF NOT EXISTS idx_invoice_custom_field_templates_doc_type 
ON public.invoice_custom_field_templates(organization_id, document_type);

-- Add comment explaining the column
COMMENT ON COLUMN public.invoice_custom_field_templates.document_type IS 
'Document type this field applies to: all, invoice, bill_of_sale, receipt, quote';