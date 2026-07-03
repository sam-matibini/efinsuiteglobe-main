-- Add DELETE policy for messages table
-- This allows organization members to delete messages within their organization

CREATE POLICY "Organization members can delete messages"
ON public.messages
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM organization_members om
    WHERE om.organization_id = messages.organization_id
    AND om.user_id = auth.uid()
  )
);