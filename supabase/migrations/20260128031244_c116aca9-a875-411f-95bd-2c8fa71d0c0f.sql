-- Allow users to insert themselves as members when accepting a valid invitation
CREATE POLICY "Users can accept invitations to join organizations"
ON public.organization_members
FOR INSERT
TO authenticated
WITH CHECK (
  -- The user_id must be the authenticated user
  user_id = auth.uid()
  AND
  -- There must be a valid pending invitation for this user/org combination
  EXISTS (
    SELECT 1 FROM public.organization_invitations inv
    WHERE inv.organization_id = organization_members.organization_id
      AND inv.email = (SELECT email FROM auth.users WHERE id = auth.uid())
      AND inv.status = 'pending'
      AND inv.expires_at > now()
  )
);

-- Allow users to update their own invitation status to accepted
CREATE POLICY "Users can accept their own invitations"
ON public.organization_invitations
FOR UPDATE
TO authenticated
USING (
  email = (SELECT email FROM auth.users WHERE id = auth.uid())
  AND status = 'pending'
)
WITH CHECK (
  email = (SELECT email FROM auth.users WHERE id = auth.uid())
  AND status = 'accepted'
);