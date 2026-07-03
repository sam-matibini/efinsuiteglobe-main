-- Add issued_at column to invoices table
ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS issued_at TIMESTAMP WITH TIME ZONE;

-- Add document_title column for Invoice/Bill of Sale/Receipt flexibility
ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS document_title TEXT DEFAULT 'Invoice';

-- Create index for issued_at for performance
CREATE INDEX IF NOT EXISTS idx_invoices_issued_at ON public.invoices(issued_at);

-- Add unique constraint on print_templates.code if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'print_templates_code_key'
  ) THEN
    ALTER TABLE public.print_templates ADD CONSTRAINT print_templates_code_key UNIQUE (code);
  END IF;
END $$;