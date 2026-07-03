-- Create table for invoice custom field templates (organization-level defaults)
CREATE TABLE public.invoice_custom_field_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  field_type TEXT NOT NULL DEFAULT 'text' CHECK (field_type IN ('text', 'number', 'date')),
  default_value TEXT,
  is_required BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.invoice_custom_field_templates ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their organization's custom field templates"
ON public.invoice_custom_field_templates
FOR SELECT
USING (
  organization_id IN (
    SELECT om.organization_id FROM public.organization_members om
    WHERE om.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create custom field templates for their organization"
ON public.invoice_custom_field_templates
FOR INSERT
WITH CHECK (
  organization_id IN (
    SELECT om.organization_id FROM public.organization_members om
    WHERE om.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their organization's custom field templates"
ON public.invoice_custom_field_templates
FOR UPDATE
USING (
  organization_id IN (
    SELECT om.organization_id FROM public.organization_members om
    WHERE om.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their organization's custom field templates"
ON public.invoice_custom_field_templates
FOR DELETE
USING (
  organization_id IN (
    SELECT om.organization_id FROM public.organization_members om
    WHERE om.user_id = auth.uid()
  )
);

-- Create updated_at trigger
CREATE TRIGGER update_invoice_custom_field_templates_updated_at
BEFORE UPDATE ON public.invoice_custom_field_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create unique constraint for label per organization
CREATE UNIQUE INDEX idx_invoice_custom_field_templates_org_label 
ON public.invoice_custom_field_templates(organization_id, label) 
WHERE is_active = true;