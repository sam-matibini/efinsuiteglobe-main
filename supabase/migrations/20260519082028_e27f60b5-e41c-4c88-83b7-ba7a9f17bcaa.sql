CREATE OR REPLACE FUNCTION public.sync_employee_to_contact()
RETURNS TRIGGER AS $$
DECLARE
  v_name TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE public.communication_contacts
      SET is_active = false, updated_at = now()
      WHERE source = 'employee' AND source_id = OLD.id;
    RETURN OLD;
  END IF;

  v_name := NULLIF(TRIM(COALESCE(NEW.first_name,'') || ' ' || COALESCE(NEW.last_name,'')), '');
  v_name := COALESCE(v_name, NEW.email, NEW.employee_number, 'Employee');

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.communication_contacts (
      organization_id, name, first_name, last_name, email, cell_phone, company,
      address_line1, address_line2, city, province, postal_code, country,
      notes, source, source_id, is_active
    ) VALUES (
      NEW.organization_id, v_name, NEW.first_name, NEW.last_name, NEW.email, NEW.phone, NEW.job_title,
      NEW.address_line1, NEW.address_line2, NEW.city, NEW.province, NEW.postal_code, NEW.country,
      NEW.notes, 'employee', NEW.id, (NEW.deleted_at IS NULL)
    );
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE public.communication_contacts
    SET name = v_name,
        first_name = NEW.first_name,
        last_name = NEW.last_name,
        email = NEW.email,
        cell_phone = NEW.phone,
        company = NEW.job_title,
        address_line1 = NEW.address_line1,
        address_line2 = NEW.address_line2,
        city = NEW.city,
        province = NEW.province,
        postal_code = NEW.postal_code,
        country = NEW.country,
        notes = NEW.notes,
        is_active = (NEW.deleted_at IS NULL),
        updated_at = now()
    WHERE source = 'employee' AND source_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS sync_employee_to_contact_trigger ON public.employees;
CREATE TRIGGER sync_employee_to_contact_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.sync_employee_to_contact();

-- Backfill existing employees (skip ones already synced)
INSERT INTO public.communication_contacts (
  organization_id, name, first_name, last_name, email, cell_phone, company,
  address_line1, address_line2, city, province, postal_code, country,
  notes, source, source_id, is_active
)
SELECT
  e.organization_id,
  COALESCE(NULLIF(TRIM(COALESCE(e.first_name,'') || ' ' || COALESCE(e.last_name,'')), ''), e.email, e.employee_number, 'Employee'),
  e.first_name, e.last_name, e.email, e.phone, e.job_title,
  e.address_line1, e.address_line2, e.city, e.province, e.postal_code, e.country,
  e.notes, 'employee', e.id, (e.deleted_at IS NULL)
FROM public.employees e
WHERE NOT EXISTS (
  SELECT 1 FROM public.communication_contacts cc
  WHERE cc.source = 'employee' AND cc.source_id = e.id
);