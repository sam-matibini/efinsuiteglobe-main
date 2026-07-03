
-- Allow authenticated users to insert audit logs even without organization context (for auth events)
-- First check existing policies
DO $$
BEGIN
  -- Drop existing insert policy if it exists
  DROP POLICY IF EXISTS "Users can insert audit logs for their org" ON public.audit_logs;
  DROP POLICY IF EXISTS "Users can insert their own audit logs" ON public.audit_logs;
END $$;

-- Create a new insert policy that allows authenticated users to insert their own audit logs
-- org_id can be null for auth events (login/signup/logout)
CREATE POLICY "Users can insert their own audit logs"
ON public.audit_logs
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND (
    organization_id IS NULL
    OR public.is_org_member(auth.uid(), organization_id)
  )
);
