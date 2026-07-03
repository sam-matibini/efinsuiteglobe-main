-- DocSign Module Tables

-- Main documents table
CREATE TABLE public.documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id),
  owner_id UUID NOT NULL,
  title TEXT NOT NULL,
  document_type TEXT DEFAULT 'contract',
  file_url TEXT,
  original_file_url TEXT,
  file_size INTEGER,
  mime_type TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'sent', 'viewed', 'signing', 'completed', 'declined', 'expired', 'voided')),
  version INTEGER DEFAULT 1,
  parent_document_id UUID REFERENCES public.documents(id),
  expires_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  signed_pdf_url TEXT,
  document_hash TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Document templates
CREATE TABLE public.document_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id),
  name TEXT NOT NULL,
  description TEXT,
  file_url TEXT,
  category TEXT,
  fields JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  use_count INTEGER DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Document fields (signature, initial, date, text, checkbox)
CREATE TABLE public.document_fields (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  template_id UUID REFERENCES public.document_templates(id),
  field_type TEXT NOT NULL CHECK (field_type IN ('signature', 'initial', 'full_name', 'date', 'checkbox', 'text', 'stamp', 'seal')),
  label TEXT,
  page_number INTEGER DEFAULT 1,
  position_x NUMERIC NOT NULL,
  position_y NUMERIC NOT NULL,
  width NUMERIC DEFAULT 200,
  height NUMERIC DEFAULT 50,
  is_required BOOLEAN DEFAULT true,
  assigned_signer_id UUID,
  filled_value TEXT,
  filled_at TIMESTAMP WITH TIME ZONE,
  validation_rules JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Document signers
CREATE TABLE public.document_signers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  role TEXT DEFAULT 'signer',
  signing_order INTEGER DEFAULT 1,
  auth_method TEXT DEFAULT 'email' CHECK (auth_method IN ('email', 'sms', 'in_app', 'id_verification')),
  phone_number TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'viewed', 'signed', 'declined')),
  access_code TEXT,
  signing_token UUID DEFAULT gen_random_uuid(),
  viewed_at TIMESTAMP WITH TIME ZONE,
  signed_at TIMESTAMP WITH TIME ZONE,
  declined_at TIMESTAMP WITH TIME ZONE,
  decline_reason TEXT,
  ip_address TEXT,
  device_info JSONB,
  consent_given BOOLEAN DEFAULT false,
  consent_timestamp TIMESTAMP WITH TIME ZONE,
  signature_data TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Signing workflows
CREATE TABLE public.signing_workflows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  workflow_type TEXT DEFAULT 'sequential' CHECK (workflow_type IN ('sequential', 'parallel', 'conditional')),
  current_step INTEGER DEFAULT 1,
  total_steps INTEGER DEFAULT 1,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  conditions JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Audit trail
CREATE TABLE public.document_audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  actor_type TEXT DEFAULT 'user' CHECK (actor_type IN ('user', 'signer', 'system')),
  actor_id TEXT,
  actor_email TEXT,
  ip_address TEXT,
  user_agent TEXT,
  device_info JSONB,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Communication Hub Tables

-- Document threads (comments, messages)
CREATE TABLE public.document_threads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  thread_type TEXT DEFAULT 'comment' CHECK (thread_type IN ('comment', 'message', 'status', 'reminder')),
  parent_thread_id UUID REFERENCES public.document_threads(id),
  author_id UUID,
  author_email TEXT,
  author_name TEXT,
  content TEXT,
  attachments JSONB DEFAULT '[]',
  is_internal BOOLEAN DEFAULT false,
  read_by JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Notifications
CREATE TABLE public.docsign_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id),
  document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE,
  recipient_id UUID,
  recipient_email TEXT,
  notification_type TEXT NOT NULL CHECK (notification_type IN ('document_sent', 'document_viewed', 'document_signed', 'document_completed', 'reminder', 'declined', 'expired')),
  channel TEXT DEFAULT 'email' CHECK (channel IN ('email', 'sms', 'push', 'in_app')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed')),
  content JSONB DEFAULT '{}',
  sent_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Reminder schedules
CREATE TABLE public.signing_reminders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  signer_id UUID REFERENCES public.document_signers(id) ON DELETE CASCADE,
  reminder_type TEXT DEFAULT 'auto' CHECK (reminder_type IN ('auto', 'manual', 'scheduled')),
  frequency_hours INTEGER DEFAULT 24,
  max_reminders INTEGER DEFAULT 3,
  reminders_sent INTEGER DEFAULT 0,
  next_reminder_at TIMESTAMP WITH TIME ZONE,
  last_reminder_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Cloud storage integrations
CREATE TABLE public.cloud_storage_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id),
  user_id UUID NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('google_drive', 'onedrive', 'dropbox', 's3')),
  access_token_encrypted TEXT,
  refresh_token_encrypted TEXT,
  token_expires_at TIMESTAMP WITH TIME ZONE,
  folder_mapping JSONB DEFAULT '{}',
  sync_enabled BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  connection_status TEXT DEFAULT 'connected' CHECK (connection_status IN ('connected', 'disconnected', 'expired', 'error')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- User signatures (saved for reuse)
CREATE TABLE public.user_signatures (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  signer_email TEXT,
  signature_type TEXT DEFAULT 'draw' CHECK (signature_type IN ('draw', 'type', 'upload')),
  signature_data TEXT NOT NULL,
  font_family TEXT,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- SMS/OTP verification logs
CREATE TABLE public.otp_verifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number TEXT NOT NULL,
  email TEXT,
  otp_code TEXT NOT NULL,
  purpose TEXT DEFAULT 'signing' CHECK (purpose IN ('signing', 'banking_mfa', 'login', 'verification')),
  reference_id UUID,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  verified_at TIMESTAMP WITH TIME ZONE,
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  twilio_message_sid TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'expired', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_signers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signing_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.docsign_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signing_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cloud_storage_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.otp_verifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for documents
CREATE POLICY "Users can view documents in their org" ON public.documents
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    ) OR owner_id = auth.uid()
  );

CREATE POLICY "Users can create documents" ON public.documents
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Owners can update their documents" ON public.documents
  FOR UPDATE USING (owner_id = auth.uid());

CREATE POLICY "Owners can delete draft documents" ON public.documents
  FOR DELETE USING (owner_id = auth.uid() AND status = 'draft');

-- RLS Policies for templates
CREATE POLICY "Users can view org templates" ON public.document_templates
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage templates" ON public.document_templates
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

-- RLS for document fields
CREATE POLICY "Users can view document fields" ON public.document_fields
  FOR SELECT USING (
    document_id IN (SELECT id FROM public.documents WHERE owner_id = auth.uid())
  );

CREATE POLICY "Users can manage document fields" ON public.document_fields
  FOR ALL USING (
    document_id IN (SELECT id FROM public.documents WHERE owner_id = auth.uid())
  );

-- RLS for signers
CREATE POLICY "Users can view signers" ON public.document_signers
  FOR SELECT USING (
    document_id IN (SELECT id FROM public.documents WHERE owner_id = auth.uid())
  );

CREATE POLICY "Users can manage signers" ON public.document_signers
  FOR ALL USING (
    document_id IN (SELECT id FROM public.documents WHERE owner_id = auth.uid())
  );

-- RLS for workflows
CREATE POLICY "Users can view workflows" ON public.signing_workflows
  FOR SELECT USING (
    document_id IN (SELECT id FROM public.documents WHERE owner_id = auth.uid())
  );

CREATE POLICY "Users can manage workflows" ON public.signing_workflows
  FOR ALL USING (
    document_id IN (SELECT id FROM public.documents WHERE owner_id = auth.uid())
  );

-- RLS for audit logs
CREATE POLICY "Users can view audit logs" ON public.document_audit_logs
  FOR SELECT USING (
    document_id IN (SELECT id FROM public.documents WHERE owner_id = auth.uid())
  );

CREATE POLICY "System can insert audit logs" ON public.document_audit_logs
  FOR INSERT WITH CHECK (true);

-- RLS for threads
CREATE POLICY "Users can view document threads" ON public.document_threads
  FOR SELECT USING (
    document_id IN (SELECT id FROM public.documents WHERE owner_id = auth.uid())
  );

CREATE POLICY "Users can manage threads" ON public.document_threads
  FOR ALL USING (auth.uid() IS NOT NULL);

-- RLS for notifications
CREATE POLICY "Users can view their notifications" ON public.docsign_notifications
  FOR SELECT USING (recipient_id = auth.uid());

CREATE POLICY "System can manage notifications" ON public.docsign_notifications
  FOR ALL USING (true);

-- RLS for reminders
CREATE POLICY "Users can view reminders" ON public.signing_reminders
  FOR SELECT USING (
    document_id IN (SELECT id FROM public.documents WHERE owner_id = auth.uid())
  );

CREATE POLICY "Users can manage reminders" ON public.signing_reminders
  FOR ALL USING (
    document_id IN (SELECT id FROM public.documents WHERE owner_id = auth.uid())
  );

-- RLS for cloud storage
CREATE POLICY "Users can view their connections" ON public.cloud_storage_connections
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can manage their connections" ON public.cloud_storage_connections
  FOR ALL USING (user_id = auth.uid());

-- RLS for signatures
CREATE POLICY "Users can view their signatures" ON public.user_signatures
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can manage their signatures" ON public.user_signatures
  FOR ALL USING (user_id = auth.uid());

-- RLS for OTP
CREATE POLICY "System can manage OTP" ON public.otp_verifications
  FOR ALL USING (true);

-- Create indexes for performance
CREATE INDEX idx_documents_org ON public.documents(organization_id);
CREATE INDEX idx_documents_owner ON public.documents(owner_id);
CREATE INDEX idx_documents_status ON public.documents(status);
CREATE INDEX idx_document_fields_doc ON public.document_fields(document_id);
CREATE INDEX idx_document_signers_doc ON public.document_signers(document_id);
CREATE INDEX idx_document_signers_email ON public.document_signers(email);
CREATE INDEX idx_document_signers_token ON public.document_signers(signing_token);
CREATE INDEX idx_audit_logs_doc ON public.document_audit_logs(document_id);
CREATE INDEX idx_threads_doc ON public.document_threads(document_id);
CREATE INDEX idx_notifications_recipient ON public.docsign_notifications(recipient_id);
CREATE INDEX idx_otp_phone ON public.otp_verifications(phone_number);
CREATE INDEX idx_otp_expires ON public.otp_verifications(expires_at);

-- Triggers for updated_at
CREATE TRIGGER update_documents_updated_at
  BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_document_templates_updated_at
  BEFORE UPDATE ON public.document_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_document_signers_updated_at
  BEFORE UPDATE ON public.document_signers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_signing_workflows_updated_at
  BEFORE UPDATE ON public.signing_workflows
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_document_threads_updated_at
  BEFORE UPDATE ON public.document_threads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_cloud_storage_updated_at
  BEFORE UPDATE ON public.cloud_storage_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_signatures_updated_at
  BEFORE UPDATE ON public.user_signatures
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();