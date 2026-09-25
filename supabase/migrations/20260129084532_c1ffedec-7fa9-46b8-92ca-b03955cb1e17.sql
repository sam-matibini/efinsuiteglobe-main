-- Create communication_senders table for multiple sender identities with titles
CREATE TABLE public.communication_senders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  communication_identity_id UUID REFERENCES public.communication_identity(id) ON DELETE SET NULL,
  
  -- Sender details
  name TEXT NOT NULL,
  title TEXT, -- e.g., CEO, Account Manager, Sales Representative
  email TEXT,
  phone TEXT,
  phone_normalized TEXT,
  
  -- Avatar/profile
  avatar_url TEXT,
  
  -- Settings
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  
  -- Audit
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for organization lookups
CREATE INDEX idx_communication_senders_org ON public.communication_senders(organization_id);
CREATE INDEX idx_communication_senders_identity ON public.communication_senders(communication_identity_id);

-- Enable RLS
ALTER TABLE public.communication_senders ENABLE ROW LEVEL SECURITY;

-- RLS policies for organization member access
CREATE POLICY "Users can view senders in their organization"
ON public.communication_senders
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = communication_senders.organization_id
    AND om.user_id = auth.uid()
  )
);

CREATE POLICY "Admins can insert senders"
ON public.communication_senders
FOR INSERT
WITH CHECK (
  public.is_org_admin_or_owner(organization_id, auth.uid())
);

CREATE POLICY "Admins can update senders"
ON public.communication_senders
FOR UPDATE
USING (
  public.is_org_admin_or_owner(organization_id, auth.uid())
);

CREATE POLICY "Admins can delete senders"
ON public.communication_senders
FOR DELETE
USING (
  public.is_org_admin_or_owner(organization_id, auth.uid())
);

-- Trigger to normalize phone numbers
CREATE OR REPLACE FUNCTION public.normalize_sender_phone()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.phone IS NOT NULL AND NEW.phone != '' THEN
    NEW.phone_normalized := regexp_replace(NEW.phone, '[^0-9+]', '', 'g');
    IF NEW.phone_normalized ~ '^[0-9]{10}$' THEN
      NEW.phone_normalized := '+1' || NEW.phone_normalized;
    END IF;
  ELSE
    NEW.phone_normalized := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_normalize_sender_phone
BEFORE INSERT OR UPDATE ON public.communication_senders
FOR EACH ROW
EXECUTE FUNCTION public.normalize_sender_phone();

-- Trigger to update updated_at
CREATE TRIGGER update_communication_senders_updated_at
BEFORE UPDATE ON public.communication_senders
FOR EACH ROW
EXECUTE FUNCTION public.update_pm_updated_at();

-- Ensure only one default sender per organization
CREATE OR REPLACE FUNCTION public.ensure_single_default_sender()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE public.communication_senders
    SET is_default = false
    WHERE organization_id = NEW.organization_id
    AND id != NEW.id
    AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_ensure_single_default_sender
BEFORE INSERT OR UPDATE ON public.communication_senders
FOR EACH ROW
EXECUTE FUNCTION public.ensure_single_default_sender();