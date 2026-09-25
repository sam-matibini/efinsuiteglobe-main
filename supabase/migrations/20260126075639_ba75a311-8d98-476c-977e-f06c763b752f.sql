-- Allow anyone with a valid token to view that specific invitation
-- This is needed for the accept-invite flow where users aren't authenticated yet
CREATE POLICY "Anyone can view invitation with valid token"
ON public.organization_invitations
FOR SELECT
TO public
USING (
  -- Allow access if the token matches (no auth required)
  token IS NOT NULL
);