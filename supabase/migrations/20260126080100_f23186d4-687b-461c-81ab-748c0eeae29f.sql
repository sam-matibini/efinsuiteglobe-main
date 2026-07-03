-- Remove the overly permissive policy that doesn't actually validate tokens
DROP POLICY IF EXISTS "Anyone can view invitation with valid token" ON public.organization_invitations;