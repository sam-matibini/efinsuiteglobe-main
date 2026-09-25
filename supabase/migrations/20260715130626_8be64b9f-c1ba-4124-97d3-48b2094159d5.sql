CREATE OR REPLACE FUNCTION public.delete_organization_cascade(_org_id uuid, _actor uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_authorized boolean := false;
BEGIN
  -- Check if actor is owner of the org
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = _org_id
      AND user_id = _actor
      AND role = 'owner'
  ) INTO is_authorized;

  -- Or global admin
  IF NOT is_authorized THEN
    SELECT public.has_role(_actor, 'admin'::app_role) INTO is_authorized;
  END IF;

  IF NOT is_authorized THEN
    RAISE EXCEPTION 'Not authorized to delete organization %', _org_id
      USING ERRCODE = '42501';
  END IF;

  -- Best-effort cleanup of tables that may lack ON DELETE CASCADE
  DELETE FROM public.organization_invitations WHERE organization_id = _org_id;
  DELETE FROM public.organization_modules WHERE organization_id = _org_id;
  DELETE FROM public.subscriptions WHERE organization_id = _org_id;
  DELETE FROM public.organization_members WHERE organization_id = _org_id;

  -- Finally delete the organization (remaining child rows should cascade)
  DELETE FROM public.organizations WHERE id = _org_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_organization_cascade(uuid, uuid) TO authenticated;