-- Add extended contact fields to communication_contacts table
ALTER TABLE public.communication_contacts
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS cell_phone text,
  ADD COLUMN IF NOT EXISTS landline text,
  ADD COLUMN IF NOT EXISTS cell_phone_normalized text,
  ADD COLUMN IF NOT EXISTS landline_normalized text,
  ADD COLUMN IF NOT EXISTS address_line1 text,
  ADD COLUMN IF NOT EXISTS address_line2 text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS province text,
  ADD COLUMN IF NOT EXISTS postal_code text,
  ADD COLUMN IF NOT EXISTS country text;

-- Update the phone normalization trigger to handle cell and landline
CREATE OR REPLACE FUNCTION public.normalize_contact_phone()
RETURNS TRIGGER AS $$
BEGIN
  -- Normalize main phone
  IF NEW.phone IS NOT NULL AND NEW.phone != '' THEN
    NEW.phone_normalized := regexp_replace(NEW.phone, '[^0-9+]', '', 'g');
    IF NEW.phone_normalized ~ '^[0-9]{10}$' THEN
      NEW.phone_normalized := '+1' || NEW.phone_normalized;
    END IF;
  ELSE
    NEW.phone_normalized := NULL;
  END IF;
  
  -- Normalize cell phone
  IF NEW.cell_phone IS NOT NULL AND NEW.cell_phone != '' THEN
    NEW.cell_phone_normalized := regexp_replace(NEW.cell_phone, '[^0-9+]', '', 'g');
    IF NEW.cell_phone_normalized ~ '^[0-9]{10}$' THEN
      NEW.cell_phone_normalized := '+1' || NEW.cell_phone_normalized;
    END IF;
  ELSE
    NEW.cell_phone_normalized := NULL;
  END IF;
  
  -- Normalize landline
  IF NEW.landline IS NOT NULL AND NEW.landline != '' THEN
    NEW.landline_normalized := regexp_replace(NEW.landline, '[^0-9+]', '', 'g');
    IF NEW.landline_normalized ~ '^[0-9]{10}$' THEN
      NEW.landline_normalized := '+1' || NEW.landline_normalized;
    END IF;
  ELSE
    NEW.landline_normalized := NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Update sync triggers to include address fields from customers/vendors
CREATE OR REPLACE FUNCTION public.sync_customer_to_contact()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.communication_contacts (
      organization_id, name, first_name, last_name, email, phone, company, 
      address_line1, address_line2, city, province, postal_code, country,
      source, source_id, is_active
    ) VALUES (
      NEW.organization_id, NEW.name, NULL, NULL, NEW.email, NEW.phone, NEW.name,
      NEW.address_line1, NEW.address_line2, NEW.city, NEW.province, NEW.postal_code, NEW.country,
      'customer', NEW.id, NEW.is_active
    );
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE public.communication_contacts
    SET name = NEW.name,
        email = NEW.email,
        phone = NEW.phone,
        company = NEW.name,
        address_line1 = NEW.address_line1,
        address_line2 = NEW.address_line2,
        city = NEW.city,
        province = NEW.province,
        postal_code = NEW.postal_code,
        country = NEW.country,
        is_active = NEW.is_active,
        updated_at = now()
    WHERE source = 'customer' AND source_id = NEW.id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.communication_contacts
    SET is_active = false, updated_at = now()
    WHERE source = 'customer' AND source_id = OLD.id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.sync_vendor_to_contact()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.communication_contacts (
      organization_id, name, first_name, last_name, email, phone, company,
      address_line1, address_line2, city, province, postal_code, country,
      source, source_id, is_active
    ) VALUES (
      NEW.organization_id, NEW.name, NULL, NULL, NEW.email, NEW.phone, NEW.name,
      NEW.address_line1, NEW.address_line2, NEW.city, NEW.province, NEW.postal_code, NEW.country,
      'vendor', NEW.id, NEW.is_active
    );
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE public.communication_contacts
    SET name = NEW.name,
        email = NEW.email,
        phone = NEW.phone,
        company = NEW.name,
        address_line1 = NEW.address_line1,
        address_line2 = NEW.address_line2,
        city = NEW.city,
        province = NEW.province,
        postal_code = NEW.postal_code,
        country = NEW.country,
        is_active = NEW.is_active,
        updated_at = now()
    WHERE source = 'vendor' AND source_id = NEW.id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.communication_contacts
    SET is_active = false, updated_at = now()
    WHERE source = 'vendor' AND source_id = OLD.id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Sync address fields from existing customers and vendors
UPDATE public.communication_contacts cc
SET 
  address_line1 = c.address_line1,
  address_line2 = c.address_line2,
  city = c.city,
  province = c.province,
  postal_code = c.postal_code,
  country = c.country
FROM public.customers c
WHERE cc.source = 'customer' AND cc.source_id = c.id;

UPDATE public.communication_contacts cc
SET 
  address_line1 = v.address_line1,
  address_line2 = v.address_line2,
  city = v.city,
  province = v.province,
  postal_code = v.postal_code,
  country = v.country
FROM public.vendors v
WHERE cc.source = 'vendor' AND cc.source_id = v.id;