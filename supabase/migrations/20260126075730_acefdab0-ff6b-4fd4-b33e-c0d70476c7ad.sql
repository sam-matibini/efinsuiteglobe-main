-- Create a security definer function to fetch invitation details with org name
-- This safely bypasses RLS for the accept-invite flow
CREATE OR REPLACE FUNCTION public.get_invitation_by_token(p_token uuid)
RETURNS TABLE (
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

-- Grant execute to public (including anon)
GRANT EXECUTE ON FUNCTION public.get_invitation_by_token(uuid) TO public;
GRANT EXECUTE ON FUNCTION public.get_invitation_by_token(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_invitation_by_token(uuid) TO authenticated;