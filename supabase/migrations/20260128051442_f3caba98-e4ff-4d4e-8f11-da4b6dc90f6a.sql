-- Update the initialize_org_modules function to also enable the new modules by default
CREATE OR REPLACE FUNCTION public.initialize_org_modules()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Add all core modules as enabled by default
  INSERT INTO public.organization_modules (organization_id, module_id, is_enabled, enabled_by)
  SELECT NEW.id, m.id, true, NEW.owner_id
  FROM public.modules m
  WHERE m.is_core = true;
  
  -- Also enable docsign, communication, and accountant_dashboard by default (non-core but commonly used)
  INSERT INTO public.organization_modules (organization_id, module_id, is_enabled, enabled_by)
  SELECT NEW.id, m.id, true, NEW.owner_id
  FROM public.modules m
  WHERE m.code IN ('docsign', 'communication', 'accountant_dashboard');
  
  RETURN NEW;
END;
$function$;