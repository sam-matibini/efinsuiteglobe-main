-- =============================================
-- ENHANCED DOCSIGN FEATURES MIGRATION
-- DocuSign-like functionality with localization
-- =============================================

-- 1. Add e-signature legal compliance fields to countries table
ALTER TABLE public.countries 
ADD COLUMN IF NOT EXISTS esignature_legal_framework TEXT DEFAULT 'ESIGN',
ADD COLUMN IF NOT EXISTS esignature_compliance_notes TEXT,
ADD COLUMN IF NOT EXISTS esignature_requires_witness BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS esignature_requires_timestamp BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS esignature_certificate_required BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS esignature_retention_years INTEGER DEFAULT 7;

-- 2. Add DocSign branding settings to organizations
ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS docsign_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS docsign_logo_url TEXT,
ADD COLUMN IF NOT EXISTS docsign_primary_color TEXT DEFAULT '#2563EB',
ADD COLUMN IF NOT EXISTS docsign_secondary_color TEXT DEFAULT '#1E40AF',
ADD COLUMN IF NOT EXISTS docsign_email_header_html TEXT,
ADD COLUMN IF NOT EXISTS docsign_email_footer_html TEXT,
ADD COLUMN IF NOT EXISTS docsign_default_reminder_days INTEGER[] DEFAULT '{3,7}',
ADD COLUMN IF NOT EXISTS docsign_default_expiration_days INTEGER DEFAULT 30,
ADD COLUMN IF NOT EXISTS docsign_retention_days INTEGER DEFAULT 2555,
ADD COLUMN IF NOT EXISTS docsign_auto_delete_expired BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS docsign_require_decline_reason BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS docsign_allow_in_person_signing BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS docsign_allow_bulk_send BOOLEAN DEFAULT true;

-- 3. Enhance document_templates table
ALTER TABLE public.document_templates
ADD COLUMN IF NOT EXISTS template_type TEXT DEFAULT 'standard',
ADD COLUMN IF NOT EXISTS signing_order_type TEXT DEFAULT 'sequential',
ADD COLUMN IF NOT EXISTS default_expiration_days INTEGER DEFAULT 30,
ADD COLUMN IF NOT EXISTS default_reminder_days INTEGER[] DEFAULT '{3,7}',
ADD COLUMN IF NOT EXISTS recipient_roles JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS routing_rules JSONB,
ADD COLUMN IF NOT EXISTS custom_email_subject TEXT,
ADD COLUMN IF NOT EXISTS custom_email_body TEXT,
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS shared_with_org BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMP WITH TIME ZONE;

-- 4. Add envelope/batch tracking for bulk sending
CREATE TABLE IF NOT EXISTS public.document_envelopes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id),
  name TEXT NOT NULL,
  description TEXT,
  template_id UUID REFERENCES public.document_templates(id),
  status TEXT DEFAULT 'draft',
  total_documents INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  completed_count INTEGER DEFAULT 0,
  declined_count INTEGER DEFAULT 0,
  expired_count INTEGER DEFAULT 0,
  bulk_send_data JSONB,
  created_by UUID,
  sent_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 5. Link documents to envelopes for bulk sending
ALTER TABLE public.documents
ADD COLUMN IF NOT EXISTS envelope_id UUID REFERENCES public.document_envelopes(id),
ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES public.document_templates(id),
ADD COLUMN IF NOT EXISTS signing_order_type TEXT DEFAULT 'sequential',
ADD COLUMN IF NOT EXISTS reminder_schedule INTEGER[] DEFAULT '{3,7}',
ADD COLUMN IF NOT EXISTS last_reminder_sent_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS reminder_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS voided_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS voided_by UUID,
ADD COLUMN IF NOT EXISTS void_reason TEXT,
ADD COLUMN IF NOT EXISTS retention_until TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS auto_delete_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS legal_framework TEXT DEFAULT 'ESIGN',
ADD COLUMN IF NOT EXISTS compliance_certificate_url TEXT,
ADD COLUMN IF NOT EXISTS is_in_person_signing BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS in_person_host_id UUID,
ADD COLUMN IF NOT EXISTS custom_email_subject TEXT,
ADD COLUMN IF NOT EXISTS custom_email_body TEXT;

-- 6. Enhance document_signers with more auth options and groups
ALTER TABLE public.document_signers
ADD COLUMN IF NOT EXISTS recipient_type TEXT DEFAULT 'signer',
ADD COLUMN IF NOT EXISTS recipient_group_id UUID,
ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS reminder_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS auth_sms_code TEXT,
ADD COLUMN IF NOT EXISTS auth_sms_sent_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS auth_sms_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS auth_id_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS auth_id_verification_data JSONB,
ADD COLUMN IF NOT EXISTS delegation_allowed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS delegated_to_id UUID,
ADD COLUMN IF NOT EXISTS delegated_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS is_in_person BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS in_person_verified_by UUID,
ADD COLUMN IF NOT EXISTS routing_order INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS routing_condition JSONB,
ADD COLUMN IF NOT EXISTS private_message TEXT,
ADD COLUMN IF NOT EXISTS language_code TEXT DEFAULT 'en',
ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{"email": true, "sms": false}';

-- 7. Create recipient groups table
CREATE TABLE IF NOT EXISTS public.document_recipient_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id),
  name TEXT NOT NULL,
  description TEXT,
  group_type TEXT DEFAULT 'any_one',
  is_active BOOLEAN DEFAULT true,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 8. Create group members table
CREATE TABLE IF NOT EXISTS public.document_recipient_group_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.document_recipient_groups(id) ON DELETE CASCADE,
  user_id UUID,
  email TEXT NOT NULL,
  name TEXT,
  is_active BOOLEAN DEFAULT true,
  added_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 9. Create document comments/annotations table
CREATE TABLE IF NOT EXISTS public.document_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  signer_id UUID REFERENCES public.document_signers(id),
  user_id UUID,
  parent_comment_id UUID REFERENCES public.document_comments(id),
  page_number INTEGER,
  position_x NUMERIC,
  position_y NUMERIC,
  comment_type TEXT DEFAULT 'note',
  content TEXT NOT NULL,
  is_resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID,
  is_private BOOLEAN DEFAULT false,
  mentions JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 10. Create document reminders table
CREATE TABLE IF NOT EXISTS public.document_reminders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  signer_id UUID REFERENCES public.document_signers(id),
  reminder_type TEXT DEFAULT 'scheduled',
  scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'pending',
  email_subject TEXT,
  email_body TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 11. Create conditional routing rules table
CREATE TABLE IF NOT EXISTS public.document_routing_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE,
  template_id UUID REFERENCES public.document_templates(id) ON DELETE CASCADE,
  rule_order INTEGER DEFAULT 1,
  rule_name TEXT NOT NULL,
  condition_type TEXT NOT NULL,
  condition_field_id UUID,
  condition_operator TEXT,
  condition_value TEXT,
  action_type TEXT NOT NULL,
  action_target_signer_order INTEGER,
  action_skip_signers INTEGER[],
  action_add_signers JSONB,
  action_terminate BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 12. Create in-person signing sessions table
CREATE TABLE IF NOT EXISTS public.document_in_person_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  host_user_id UUID NOT NULL,
  session_token UUID DEFAULT gen_random_uuid(),
  status TEXT DEFAULT 'active',
  current_signer_id UUID REFERENCES public.document_signers(id),
  device_info JSONB,
  location_info JSONB,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  ip_address TEXT
);

-- 13. Create document retention policies table
CREATE TABLE IF NOT EXISTS public.document_retention_policies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  policy_name TEXT NOT NULL,
  description TEXT,
  document_type TEXT,
  category TEXT,
  retention_days INTEGER NOT NULL,
  action_on_expiry TEXT DEFAULT 'archive',
  notify_before_days INTEGER DEFAULT 30,
  notify_emails TEXT[],
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 14. Create compliance certificates table
CREATE TABLE IF NOT EXISTS public.document_compliance_certificates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  certificate_type TEXT NOT NULL,
  legal_framework TEXT NOT NULL,
  country_code TEXT,
  certificate_data JSONB NOT NULL,
  certificate_hash TEXT,
  issued_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  valid_until TIMESTAMP WITH TIME ZONE,
  certificate_url TEXT
);

-- 15. Enhanced audit log with more action types
ALTER TABLE public.document_audit_logs
ADD COLUMN IF NOT EXISTS country_code TEXT,
ADD COLUMN IF NOT EXISTS legal_framework TEXT,
ADD COLUMN IF NOT EXISTS session_id UUID,
ADD COLUMN IF NOT EXISTS geo_location JSONB,
ADD COLUMN IF NOT EXISTS browser_info JSONB,
ADD COLUMN IF NOT EXISTS compliance_relevant BOOLEAN DEFAULT false;

-- Enable RLS on all new tables
ALTER TABLE public.document_envelopes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_recipient_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_recipient_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_routing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_in_person_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_retention_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_compliance_certificates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for document_envelopes
CREATE POLICY "Users can view envelopes in their org" ON public.document_envelopes
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create envelopes in their org" ON public.document_envelopes
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update envelopes in their org" ON public.document_envelopes
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for document_recipient_groups
CREATE POLICY "Users can view recipient groups in their org" ON public.document_recipient_groups
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage recipient groups in their org" ON public.document_recipient_groups
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for document_recipient_group_members
CREATE POLICY "Users can view group members" ON public.document_recipient_group_members
  FOR SELECT USING (
    group_id IN (
      SELECT id FROM public.document_recipient_groups WHERE organization_id IN (
        SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can manage group members" ON public.document_recipient_group_members
  FOR ALL USING (
    group_id IN (
      SELECT id FROM public.document_recipient_groups WHERE organization_id IN (
        SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
      )
    )
  );

-- RLS Policies for document_comments
CREATE POLICY "Users can view document comments" ON public.document_comments
  FOR SELECT USING (
    document_id IN (
      SELECT id FROM public.documents WHERE organization_id IN (
        SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
      )
    ) OR
    signer_id IN (SELECT id FROM public.document_signers WHERE email = auth.email())
  );

CREATE POLICY "Users can create comments" ON public.document_comments
  FOR INSERT WITH CHECK (
    document_id IN (
      SELECT id FROM public.documents WHERE organization_id IN (
        SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
      )
    ) OR user_id = auth.uid()
  );

-- RLS Policies for document_reminders
CREATE POLICY "Users can view reminders for their documents" ON public.document_reminders
  FOR SELECT USING (
    document_id IN (
      SELECT id FROM public.documents WHERE organization_id IN (
        SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can manage reminders for their documents" ON public.document_reminders
  FOR ALL USING (
    document_id IN (
      SELECT id FROM public.documents WHERE organization_id IN (
        SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
      )
    )
  );

-- RLS Policies for document_routing_rules
CREATE POLICY "Users can view routing rules" ON public.document_routing_rules
  FOR SELECT USING (
    document_id IN (
      SELECT id FROM public.documents WHERE organization_id IN (
        SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
      )
    ) OR
    template_id IN (
      SELECT id FROM public.document_templates WHERE organization_id IN (
        SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can manage routing rules" ON public.document_routing_rules
  FOR ALL USING (
    document_id IN (
      SELECT id FROM public.documents WHERE organization_id IN (
        SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
      )
    ) OR
    template_id IN (
      SELECT id FROM public.document_templates WHERE organization_id IN (
        SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
      )
    )
  );

-- RLS Policies for document_in_person_sessions
CREATE POLICY "Hosts can view their sessions" ON public.document_in_person_sessions
  FOR SELECT USING (host_user_id = auth.uid());

CREATE POLICY "Hosts can manage their sessions" ON public.document_in_person_sessions
  FOR ALL USING (host_user_id = auth.uid());

-- RLS Policies for document_retention_policies
CREATE POLICY "Users can view retention policies in their org" ON public.document_retention_policies
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage retention policies in their org" ON public.document_retention_policies
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for document_compliance_certificates
CREATE POLICY "Users can view compliance certificates" ON public.document_compliance_certificates
  FOR SELECT USING (
    document_id IN (
      SELECT id FROM public.documents WHERE organization_id IN (
        SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
      )
    )
  );

-- Update countries with e-signature legal frameworks
UPDATE public.countries SET
  esignature_legal_framework = 'ESIGN/UETA',
  esignature_requires_witness = false,
  esignature_requires_timestamp = true,
  esignature_certificate_required = false,
  esignature_retention_years = 7
WHERE code IN ('US');

UPDATE public.countries SET
  esignature_legal_framework = 'PIPEDA/Provincial',
  esignature_requires_witness = false,
  esignature_requires_timestamp = true,
  esignature_certificate_required = false,
  esignature_retention_years = 7
WHERE code IN ('CA');

UPDATE public.countries SET
  esignature_legal_framework = 'eIDAS',
  esignature_requires_witness = false,
  esignature_requires_timestamp = true,
  esignature_certificate_required = true,
  esignature_retention_years = 10
WHERE code IN ('DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'AT', 'PT', 'PL', 'SE', 'DK', 'FI', 'IE', 'GR', 'CZ', 'RO', 'HU', 'SK', 'BG', 'HR', 'SI', 'LT', 'LV', 'EE', 'CY', 'LU', 'MT');

UPDATE public.countries SET
  esignature_legal_framework = 'ECA 2000',
  esignature_requires_witness = false,
  esignature_requires_timestamp = true,
  esignature_certificate_required = false,
  esignature_retention_years = 6
WHERE code IN ('GB');

UPDATE public.countries SET
  esignature_legal_framework = 'ETA 1999',
  esignature_requires_witness = true,
  esignature_requires_timestamp = true,
  esignature_certificate_required = false,
  esignature_retention_years = 8
WHERE code IN ('AU');

UPDATE public.countries SET
  esignature_legal_framework = 'ECA 2002',
  esignature_requires_witness = false,
  esignature_requires_timestamp = true,
  esignature_certificate_required = false,
  esignature_retention_years = 7
WHERE code IN ('NZ');

UPDATE public.countries SET
  esignature_legal_framework = 'IT Act 2000',
  esignature_requires_witness = false,
  esignature_requires_timestamp = true,
  esignature_certificate_required = true,
  esignature_retention_years = 8
WHERE code IN ('IN');

UPDATE public.countries SET
  esignature_legal_framework = 'ECA 2006',
  esignature_requires_witness = false,
  esignature_requires_timestamp = true,
  esignature_certificate_required = false,
  esignature_retention_years = 7
WHERE code IN ('SG');

UPDATE public.countries SET
  esignature_legal_framework = 'ETO',
  esignature_requires_witness = false,
  esignature_requires_timestamp = true,
  esignature_certificate_required = true,
  esignature_retention_years = 7
WHERE code IN ('HK');

UPDATE public.countries SET
  esignature_legal_framework = 'ESA 2001',
  esignature_requires_witness = false,
  esignature_requires_timestamp = true,
  esignature_certificate_required = true,
  esignature_retention_years = 5
WHERE code IN ('JP');

UPDATE public.countries SET
  esignature_legal_framework = 'DSA 2015',
  esignature_requires_witness = false,
  esignature_requires_timestamp = true,
  esignature_certificate_required = true,
  esignature_retention_years = 5
WHERE code IN ('KR');

UPDATE public.countries SET
  esignature_legal_framework = 'ESL 2019',
  esignature_requires_witness = true,
  esignature_requires_timestamp = true,
  esignature_certificate_required = true,
  esignature_retention_years = 10
WHERE code IN ('CN');

UPDATE public.countries SET
  esignature_legal_framework = 'MP 2200-2',
  esignature_requires_witness = false,
  esignature_requires_timestamp = true,
  esignature_certificate_required = true,
  esignature_retention_years = 5
WHERE code IN ('BR');

UPDATE public.countries SET
  esignature_legal_framework = 'Federal/State Mix',
  esignature_requires_witness = false,
  esignature_requires_timestamp = true,
  esignature_certificate_required = false,
  esignature_retention_years = 5
WHERE code IN ('MX');

UPDATE public.countries SET
  esignature_legal_framework = 'ECTA 2002',
  esignature_requires_witness = false,
  esignature_requires_timestamp = true,
  esignature_certificate_required = false,
  esignature_retention_years = 5
WHERE code IN ('ZA');

UPDATE public.countries SET
  esignature_legal_framework = 'ETL 2001',
  esignature_requires_witness = false,
  esignature_requires_timestamp = true,
  esignature_certificate_required = false,
  esignature_retention_years = 10
WHERE code IN ('AE', 'SA', 'QA', 'KW', 'BH', 'OM');

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_document_envelopes_org ON public.document_envelopes(organization_id);
CREATE INDEX IF NOT EXISTS idx_document_envelopes_status ON public.document_envelopes(status);
CREATE INDEX IF NOT EXISTS idx_document_comments_document ON public.document_comments(document_id);
CREATE INDEX IF NOT EXISTS idx_document_reminders_scheduled ON public.document_reminders(scheduled_for) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_document_routing_rules_document ON public.document_routing_rules(document_id);
CREATE INDEX IF NOT EXISTS idx_document_routing_rules_template ON public.document_routing_rules(template_id);
CREATE INDEX IF NOT EXISTS idx_documents_envelope ON public.documents(envelope_id);
CREATE INDEX IF NOT EXISTS idx_documents_retention ON public.documents(retention_until) WHERE retention_until IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_document_signers_group ON public.document_signers(recipient_group_id);