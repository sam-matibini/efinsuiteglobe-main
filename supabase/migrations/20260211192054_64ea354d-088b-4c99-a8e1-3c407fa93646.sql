
CREATE OR REPLACE FUNCTION public.get_org_member_details(p_organization_id uuid)
 RETURNS TABLE(member_id uuid, user_id uuid, role text, display_name text, joined_at timestamp with time zone, created_at timestamp with time zone, email text, full_name text, avatar_url text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Verify caller is a member of the organization OR is a platform admin
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members om_check
    WHERE om_check.organization_id = p_organization_id 
    AND om_check.user_id = auth.uid()
  ) AND NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Not a member of this organization';
  END IF;
  
  RETURN QUERY
  SELECT 
    om.id as member_id,
    om.user_id,
    om.role,
    om.display_name,
    om.joined_at,
    om.created_at,
    COALESCE(p.email, au.email) as email,
    COALESCE(p.full_name, au.raw_user_meta_data->>'full_name') as full_name,
    p.avatar_url
  FROM public.organization_members om
  LEFT JOIN public.profiles p ON om.user_id = p.user_id
  LEFT JOIN auth.users au ON om.user_id = au.id
  WHERE om.organization_id = p_organization_id
  ORDER BY om.created_at ASC;
END;
$function$;
