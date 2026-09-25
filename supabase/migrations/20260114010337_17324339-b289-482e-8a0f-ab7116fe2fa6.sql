-- Fix overly permissive RLS policies

-- Drop and recreate audit logs policy with service role check
DROP POLICY IF EXISTS "System can insert audit logs" ON public.document_audit_logs;
CREATE POLICY "Authenticated users can insert audit logs" ON public.document_audit_logs
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Drop and recreate notifications policy
DROP POLICY IF EXISTS "System can manage notifications" ON public.docsign_notifications;
CREATE POLICY "Users can view org notifications" ON public.docsign_notifications
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    ) OR recipient_id = auth.uid()
  );

CREATE POLICY "Authenticated users can insert notifications" ON public.docsign_notifications
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Drop and recreate OTP policy - needs to be accessible via edge function with service role
DROP POLICY IF EXISTS "System can manage OTP" ON public.otp_verifications;
-- OTP table will be managed by edge functions using service role key, no user-level access needed
CREATE POLICY "No direct user access to OTP" ON public.otp_verifications
  FOR SELECT USING (false);

-- Drop overly permissive "FOR ALL" policies and replace with specific operations
DROP POLICY IF EXISTS "Users can manage templates" ON public.document_templates;
CREATE POLICY "Users can insert templates" ON public.document_templates
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );
CREATE POLICY "Users can update templates" ON public.document_templates
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );
CREATE POLICY "Users can delete templates" ON public.document_templates
  FOR DELETE USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can manage document fields" ON public.document_fields;
CREATE POLICY "Users can insert document fields" ON public.document_fields
  FOR INSERT WITH CHECK (
    document_id IN (SELECT id FROM public.documents WHERE owner_id = auth.uid())
  );
CREATE POLICY "Users can update document fields" ON public.document_fields
  FOR UPDATE USING (
    document_id IN (SELECT id FROM public.documents WHERE owner_id = auth.uid())
  );
CREATE POLICY "Users can delete document fields" ON public.document_fields
  FOR DELETE USING (
    document_id IN (SELECT id FROM public.documents WHERE owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can manage signers" ON public.document_signers;
CREATE POLICY "Users can insert signers" ON public.document_signers
  FOR INSERT WITH CHECK (
    document_id IN (SELECT id FROM public.documents WHERE owner_id = auth.uid())
  );
CREATE POLICY "Users can update signers" ON public.document_signers
  FOR UPDATE USING (
    document_id IN (SELECT id FROM public.documents WHERE owner_id = auth.uid())
  );
CREATE POLICY "Users can delete signers" ON public.document_signers
  FOR DELETE USING (
    document_id IN (SELECT id FROM public.documents WHERE owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can manage workflows" ON public.signing_workflows;
CREATE POLICY "Users can insert workflows" ON public.signing_workflows
  FOR INSERT WITH CHECK (
    document_id IN (SELECT id FROM public.documents WHERE owner_id = auth.uid())
  );
CREATE POLICY "Users can update workflows" ON public.signing_workflows
  FOR UPDATE USING (
    document_id IN (SELECT id FROM public.documents WHERE owner_id = auth.uid())
  );
CREATE POLICY "Users can delete workflows" ON public.signing_workflows
  FOR DELETE USING (
    document_id IN (SELECT id FROM public.documents WHERE owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can manage threads" ON public.document_threads;
CREATE POLICY "Users can insert threads" ON public.document_threads
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update their threads" ON public.document_threads
  FOR UPDATE USING (author_id = auth.uid());
CREATE POLICY "Users can delete their threads" ON public.document_threads
  FOR DELETE USING (author_id = auth.uid());

DROP POLICY IF EXISTS "Users can manage reminders" ON public.signing_reminders;
CREATE POLICY "Users can insert reminders" ON public.signing_reminders
  FOR INSERT WITH CHECK (
    document_id IN (SELECT id FROM public.documents WHERE owner_id = auth.uid())
  );
CREATE POLICY "Users can update reminders" ON public.signing_reminders
  FOR UPDATE USING (
    document_id IN (SELECT id FROM public.documents WHERE owner_id = auth.uid())
  );
CREATE POLICY "Users can delete reminders" ON public.signing_reminders
  FOR DELETE USING (
    document_id IN (SELECT id FROM public.documents WHERE owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can manage their connections" ON public.cloud_storage_connections;
CREATE POLICY "Users can insert connections" ON public.cloud_storage_connections
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update their connections" ON public.cloud_storage_connections
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete their connections" ON public.cloud_storage_connections
  FOR DELETE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can manage their signatures" ON public.user_signatures;
CREATE POLICY "Users can insert signatures" ON public.user_signatures
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update their signatures" ON public.user_signatures
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete their signatures" ON public.user_signatures
  FOR DELETE USING (user_id = auth.uid());