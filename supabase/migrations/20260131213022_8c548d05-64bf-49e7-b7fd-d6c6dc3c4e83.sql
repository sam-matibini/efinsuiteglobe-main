-- Fix: avoid referencing auth.users in RLS policies (causes permission denied)
-- Rewrite the invite-acceptance INSERT policy on organization_members to use JWT email claim instead.

DROP POLICY IF EXISTS "Users can accept invitations to join organizations" ON public.organization_members;

CREATE POLICY "Users can accept invitations to join organizations"
ON public.organization_members
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.organization_invitations inv
    WHERE inv.organization_id = organization_members.organization_id
      AND inv.email = (auth.jwt() ->> 'email')
      AND inv.status = 'pending'
      AND inv.expires_at > now()
  )
);
