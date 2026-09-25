-- Update the SELECT policy on organization_invitations to also allow platform admins
DROP POLICY "Org members can view invitations" ON public.organization_invitations;

CREATE POLICY "Org members can view invitations"
ON public.organization_invitations
FOR SELECT
USING (
  is_org_member(auth.uid(), organization_id)
  OR EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);