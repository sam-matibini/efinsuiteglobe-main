-- Update document_fields field_type column documentation to include new profile-based field types
-- These field types support DocuSign/Adobe-style field anchoring with user profile auto-population

COMMENT ON COLUMN public.document_fields.field_type IS 
  'Field type for document signing. Valid values: signature, initial, full_name, first_name, last_name, email, company, title, date, checkbox, text, stamp. Profile-based fields (first_name, last_name, email, company, title) auto-populate from user/organization settings.';

-- Add metadata column to store field configuration (like default values from org settings)
ALTER TABLE public.document_fields 
  ADD COLUMN IF NOT EXISTS field_config JSONB DEFAULT NULL;

COMMENT ON COLUMN public.document_fields.field_config IS 
  'Optional configuration for the field including auto-populate source (user_profile, organization, signer), font settings, and display options.';

-- Create index for faster field type queries
CREATE INDEX IF NOT EXISTS idx_document_fields_field_type 
  ON public.document_fields(field_type);

-- Create index for assigned signer lookups
CREATE INDEX IF NOT EXISTS idx_document_fields_assigned_signer 
  ON public.document_fields(assigned_signer_id) 
  WHERE assigned_signer_id IS NOT NULL;