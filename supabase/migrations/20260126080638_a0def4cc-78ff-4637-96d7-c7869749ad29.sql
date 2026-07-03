
-- Drop and recreate the function with proper public access
DROP FUNCTION IF EXISTS public.get_invitation_by_token(uuid);

CREATE OR REPLACE FUNCTION public.get_invitation_by_token(p_token uuid)
RETURNS TABLE(
  id uuid,
  organization_id uuid,
  organization_name text,
  email text,
  role text,
  status text,
  expires_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    i.id,
    i.organization_id,
    o.name AS organization_name,
    i.email,
    i.role,
    i.status,
    i.expires_at
  FROM public.organization_invitations i
  JOIN public.organizations o ON o.id = i.organization_id
  WHERE i.token = p_token;
END;
$$;

-- Grant execute to all roles including anon (for unauthenticated invitation accepters)
GRANT EXECUTE ON FUNCTION public.get_invitation_by_token(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_invitation_by_token(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_invitation_by_token(uuid) TO service_role;

-- Also ensure the function is in the API exposed schemas
COMMENT ON FUNCTION public.get_invitation_by_token(uuid) IS 'Get invitation details by token, used for accepting invitations';
