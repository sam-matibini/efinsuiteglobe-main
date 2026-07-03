-- Fix the permissive audit_logs insert policy to be more restrictive
DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs;

-- Only allow inserting audit logs for organizations the user is a member of
CREATE POLICY "Users can insert audit logs for their orgs"
  ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (
    public.is_org_member(auth.uid(), organization_id) 
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );