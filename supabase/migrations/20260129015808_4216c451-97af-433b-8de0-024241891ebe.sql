-- Create contact type enum
CREATE TYPE public.contact_source AS ENUM ('manual', 'customer', 'vendor');

-- Create communication_contacts table
CREATE TABLE public.communication_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  phone_normalized VARCHAR(50),
  company VARCHAR(255),
  notes TEXT,
  source contact_source NOT NULL DEFAULT 'manual',
  source_id UUID, -- Reference to customer or vendor ID if linked
  is_favorite BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  tags TEXT[],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Create indexes for performance
CREATE INDEX idx_communication_contacts_org ON public.communication_contacts(organization_id);
CREATE INDEX idx_communication_contacts_phone ON public.communication_contacts(phone_normalized);
CREATE INDEX idx_communication_contacts_email ON public.communication_contacts(email);
CREATE INDEX idx_communication_contacts_source ON public.communication_contacts(source, source_id);
CREATE INDEX idx_communication_contacts_favorite ON public.communication_contacts(organization_id, is_favorite) WHERE is_favorite = true;

-- Enable RLS
ALTER TABLE public.communication_contacts ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view contacts in their organization"
  ON public.communication_contacts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_id = communication_contacts.organization_id
        AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create contacts in their organization"
  ON public.communication_contacts FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_id = communication_contacts.organization_id
        AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update contacts in their organization"
  ON public.communication_contacts FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_id = communication_contacts.organization_id
        AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete contacts in their organization"
  ON public.communication_contacts FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_id = communication_contacts.organization_id
        AND user_id = auth.uid()
    )
  );

-- Function to normalize phone numbers
CREATE OR REPLACE FUNCTION public.normalize_contact_phone()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.phone IS NOT NULL AND NEW.phone != '' THEN
    -- Remove all non-digit characters except leading +
    NEW.phone_normalized := regexp_replace(NEW.phone, '[^\d+]', '', 'g');
    -- If no + prefix and 10 digits, assume North American and add +1
    IF NOT NEW.phone_normalized LIKE '+%' THEN
      IF length(regexp_replace(NEW.phone_normalized, '\D', '', 'g')) = 10 THEN
        NEW.phone_normalized := '+1' || regexp_replace(NEW.phone_normalized, '\D', '', 'g');
      ELSIF length(regexp_replace(NEW.phone_normalized, '\D', '', 'g')) = 11 AND NEW.phone_normalized LIKE '1%' THEN
        NEW.phone_normalized := '+' || regexp_replace(NEW.phone_normalized, '\D', '', 'g');
      ELSE
        NEW.phone_normalized := '+' || regexp_replace(NEW.phone_normalized, '\D', '', 'g');
      END IF;
    END IF;
  ELSE
    NEW.phone_normalized := NULL;
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger to normalize phone on insert/update
CREATE TRIGGER normalize_contact_phone_trigger
  BEFORE INSERT OR UPDATE ON public.communication_contacts
  FOR EACH ROW EXECUTE FUNCTION public.normalize_contact_phone();

-- Function to update updated_at
CREATE TRIGGER update_communication_contacts_updated_at
  BEFORE UPDATE ON public.communication_contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_pm_updated_at();

-- Function to sync customers to contacts
CREATE OR REPLACE FUNCTION public.sync_customer_to_contact()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.communication_contacts (
      organization_id, name, email, phone, company, source, source_id, is_active
    ) VALUES (
      NEW.organization_id, NEW.name, NEW.email, NEW.phone, NEW.name, 'customer', NEW.id, NEW.is_active
    );
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE public.communication_contacts
    SET 
      name = NEW.name,
      email = NEW.email,
      phone = NEW.phone,
      company = NEW.name,
      is_active = NEW.is_active,
      updated_at = now()
    WHERE source = 'customer' AND source_id = NEW.id;
  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM public.communication_contacts
    WHERE source = 'customer' AND source_id = OLD.id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Function to sync vendors to contacts
CREATE OR REPLACE FUNCTION public.sync_vendor_to_contact()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.communication_contacts (
      organization_id, name, email, phone, company, source, source_id, is_active
    ) VALUES (
      NEW.organization_id, NEW.name, NEW.email, NEW.phone, NEW.name, 'vendor', NEW.id, NEW.is_active
    );
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE public.communication_contacts
    SET 
      name = NEW.name,
      email = NEW.email,
      phone = NEW.phone,
      company = NEW.name,
      is_active = NEW.is_active,
      updated_at = now()
    WHERE source = 'vendor' AND source_id = NEW.id;
  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM public.communication_contacts
    WHERE source = 'vendor' AND source_id = OLD.id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create triggers to sync customers and vendors
CREATE TRIGGER sync_customer_to_contact_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.sync_customer_to_contact();

CREATE TRIGGER sync_vendor_to_contact_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.vendors
  FOR EACH ROW EXECUTE FUNCTION public.sync_vendor_to_contact();