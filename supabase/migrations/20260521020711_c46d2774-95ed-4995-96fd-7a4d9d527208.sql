CREATE OR REPLACE FUNCTION public.is_org_member(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE (user_id = _user_id AND organization_id = _org_id)
       OR (user_id = _org_id AND organization_id = _user_id)
  );
$$;