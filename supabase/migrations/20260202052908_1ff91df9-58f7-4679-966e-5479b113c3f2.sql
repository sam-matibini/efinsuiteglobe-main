-- Add PDF dimension tracking to document_fields for accurate coordinate mapping
ALTER TABLE public.document_fields
  ADD COLUMN IF NOT EXISTS pdf_page_width_pt NUMERIC DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS pdf_page_height_pt NUMERIC DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.document_fields.pdf_page_width_pt IS 'PDF page width in points at time of field placement';
COMMENT ON COLUMN public.document_fields.pdf_page_height_pt IS 'PDF page height in points at time of field placement';