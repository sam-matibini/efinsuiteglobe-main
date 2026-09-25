-- Create organization invitations table
CREATE TABLE public.organization_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  token UUID NOT NULL DEFAULT gen_random_uuid(),
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '7 days'),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  accepted_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(organization_id, email, status)
);

-- Enable RLS
ALTER TABLE public.organization_invitations ENABLE ROW LEVEL SECURITY;

-- Policy: Org members can view invitations for their org
CREATE POLICY "Org members can view invitations"
ON public.organization_invitations
FOR SELECT
USING (public.is_org_member(auth.uid(), organization_id));

-- Policy: Org admins/owners can create invitations
CREATE POLICY "Org admins can create invitations"
ON public.organization_invitations
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = organization_invitations.organization_id
    AND user_id = auth.uid()
    AND role IN ('owner', 'admin')
  )
  OR EXISTS (
    SELECT 1 FROM public.organizations
    WHERE id = organization_invitations.organization_id
    AND owner_id = auth.uid()
  )
);

-- Policy: Org admins/owners can update invitations (cancel, resend)
CREATE POLICY "Org admins can update invitations"
ON public.organization_invitations
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = organization_invitations.organization_id
    AND user_id = auth.uid()
    AND role IN ('owner', 'admin')
  )
  OR EXISTS (
    SELECT 1 FROM public.organizations
    WHERE id = organization_invitations.organization_id
    AND owner_id = auth.uid()
  )
);

-- Policy: Org admins/owners can delete invitations
CREATE POLICY "Org admins can delete invitations"
ON public.organization_invitations
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = organization_invitations.organization_id
    AND user_id = auth.uid()
    AND role IN ('owner', 'admin')
  )
  OR EXISTS (
    SELECT 1 FROM public.organizations
    WHERE id = organization_invitations.organization_id
    AND owner_id = auth.uid()
  )
);

-- Index for faster lookups
CREATE INDEX idx_org_invitations_org_id ON public.organization_invitations(organization_id);
CREATE INDEX idx_org_invitations_token ON public.organization_invitations(token);
CREATE INDEX idx_org_invitations_email ON public.organization_invitations(email);