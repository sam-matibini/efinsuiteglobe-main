-- Create table for storing mapping templates
CREATE TABLE public.statement_mapping_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  statement_type TEXT NOT NULL CHECK (statement_type IN ('bank', 'creditcard')),
  bank_name TEXT,
  account_name TEXT,
  mappings JSONB NOT NULL DEFAULT '[]'::jsonb,
  date_format TEXT NOT NULL DEFAULT 'auto',
  number_format TEXT NOT NULL DEFAULT 'standard',
  invert_sign BOOLEAN NOT NULL DEFAULT false,
  treat_brackets_as_negative BOOLEAN NOT NULL DEFAULT true,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.statement_mapping_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view templates in their organization"
  ON public.statement_mapping_templates
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create templates in their organization"
  ON public.statement_mapping_templates
  FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update templates in their organization"
  ON public.statement_mapping_templates
  FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete templates in their organization"
  ON public.statement_mapping_templates
  FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members 
      WHERE user_id = auth.uid()
    )
  );

-- Create index for faster lookups
CREATE INDEX idx_mapping_templates_org_type ON public.statement_mapping_templates(organization_id, statement_type);

-- Add trigger for updated_at
CREATE TRIGGER update_statement_mapping_templates_updated_at
  BEFORE UPDATE ON public.statement_mapping_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();