-- Drop the problematic unique constraint that prevents multiple cancelled/accepted invitations
ALTER TABLE public.organization_invitations 
DROP CONSTRAINT IF EXISTS organization_invitations_organization_id_email_status_key;

-- Add a partial unique constraint that only prevents duplicate pending invitations
CREATE UNIQUE INDEX organization_invitations_unique_pending 
ON public.organization_invitations (organization_id, email) 
WHERE status = 'pending';