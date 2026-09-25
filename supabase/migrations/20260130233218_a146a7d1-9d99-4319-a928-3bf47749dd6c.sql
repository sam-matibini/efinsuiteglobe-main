-- Add soft delete support to invoices table
ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS deleted_by UUID DEFAULT NULL;

-- Add soft delete support to bills table
ALTER TABLE public.bills
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS deleted_by UUID DEFAULT NULL;

-- Add deletion configuration to countries (which statuses can be deleted per region)
ALTER TABLE public.countries
ADD COLUMN IF NOT EXISTS invoice_deletion_config JSONB DEFAULT '{"allowed_statuses": ["void", "issued"], "require_reason": false, "soft_delete": true}'::jsonb;

-- Add organization-level deletion preferences
ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS allow_invoice_deletion BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS invoice_deletion_allowed_statuses TEXT[] DEFAULT ARRAY['void', 'issued'];

-- Update countries with localized deletion configurations
UPDATE public.countries SET
  invoice_deletion_config = '{"allowed_statuses": ["void", "issued"], "require_reason": false, "soft_delete": true, "label": "Delete Invoice"}'::jsonb
WHERE code = 'CA';

UPDATE public.countries SET
  invoice_deletion_config = '{"allowed_statuses": ["void", "issued"], "require_reason": true, "soft_delete": true, "label": "Delete Invoice"}'::jsonb
WHERE code = 'US';

UPDATE public.countries SET
  invoice_deletion_config = '{"allowed_statuses": ["void", "issued"], "require_reason": true, "soft_delete": true, "label": "Delete Invoice"}'::jsonb
WHERE code = 'GB';

UPDATE public.countries SET
  invoice_deletion_config = '{"allowed_statuses": ["void", "issued"], "require_reason": false, "soft_delete": true, "label": "Delete Invoice"}'::jsonb
WHERE code IN ('ZM', 'KE', 'NG', 'AU');

-- Create indexes for soft delete queries
CREATE INDEX IF NOT EXISTS idx_invoices_deleted_at ON public.invoices(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_bills_deleted_at ON public.bills(deleted_at) WHERE deleted_at IS NULL;

-- Add comments for documentation
COMMENT ON COLUMN public.invoices.deleted_at IS 'Soft delete timestamp - NULL means active';
COMMENT ON COLUMN public.invoices.deleted_by IS 'User who deleted the invoice';
COMMENT ON COLUMN public.bills.deleted_at IS 'Soft delete timestamp - NULL means active';
COMMENT ON COLUMN public.bills.deleted_by IS 'User who deleted the bill';