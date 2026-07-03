-- Create communication templates table
CREATE TABLE public.communication_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'sms', 'whatsapp', 'all')),
  subject TEXT, -- For email templates
  body TEXT NOT NULL,
  category TEXT, -- e.g., 'follow-up', 'reminder', 'greeting', 'invoice'
  variables TEXT[], -- e.g., ['{{name}}', '{{company}}', '{{date}}']
  is_default BOOLEAN DEFAULT false,
  use_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.communication_templates ENABLE ROW LEVEL SECURITY;

-- RLS policies for organization isolation
CREATE POLICY "Users can view templates in their organization"
ON public.communication_templates
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = communication_templates.organization_id
    AND om.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create templates in their organization"
ON public.communication_templates
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = communication_templates.organization_id
    AND om.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update templates in their organization"
ON public.communication_templates
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = communication_templates.organization_id
    AND om.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete templates in their organization"
ON public.communication_templates
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = communication_templates.organization_id
    AND om.user_id = auth.uid()
  )
);

-- Create index for faster queries
CREATE INDEX idx_communication_templates_org_channel ON public.communication_templates(organization_id, channel);
CREATE INDEX idx_communication_templates_category ON public.communication_templates(organization_id, category);

-- Trigger to update updated_at
CREATE TRIGGER update_communication_templates_updated_at
  BEFORE UPDATE ON public.communication_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_pm_updated_at();