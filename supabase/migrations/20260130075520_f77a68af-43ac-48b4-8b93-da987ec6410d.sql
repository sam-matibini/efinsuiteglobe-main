-- =============================================
-- PRINT & PDF FRAMEWORK SCHEMA
-- Multi-country, multi-organization, audit-safe
-- =============================================

-- Document type enum for template categorization
CREATE TYPE public.print_document_type AS ENUM (
  'balance_sheet', 'income_statement', 'cash_flow', 'trial_balance', 'statement_equity',
  'general_ledger', 'sub_ledger', 'detailed_ledger',
  'invoice', 'credit_note', 'receipt', 'payment', 'bill',
  'bank_reconciliation', 'credit_card_reconciliation',
  'pay_stub', 'pay_summary', 't4', 'w2', 'roe', 'tax_filing',
  'gst_hst_return', 'vat_return', 'paye_return',
  'audit_report', 'compilation_report', 'signed_document',
  'custom'
);

-- Paper size enum
CREATE TYPE public.paper_size AS ENUM ('letter', 'a4', 'legal', 'a3');

-- Template status enum
CREATE TYPE public.template_status AS ENUM ('draft', 'active', 'archived');

-- Print action type for audit logging
CREATE TYPE public.print_action_type AS ENUM ('print', 'pdf_generate', 'pdf_download', 'preview');

-- =============================================
-- TEMPLATE MANAGEMENT TABLES
-- =============================================

-- Master template library
CREATE TABLE public.print_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  document_type print_document_type NOT NULL,
  description TEXT,
  
  -- Hierarchy: NULL = base template
  parent_template_id UUID REFERENCES public.print_templates(id),
  country_id UUID REFERENCES public.countries(id),
  organization_id UUID REFERENCES public.organizations(id),
  
  -- Template content
  header_template JSONB DEFAULT '{}',
  body_template JSONB DEFAULT '{}',
  footer_template JSONB DEFAULT '{}',
  styles JSONB DEFAULT '{}',
  
  -- Layout settings
  paper_size paper_size DEFAULT 'letter',
  orientation TEXT DEFAULT 'portrait' CHECK (orientation IN ('portrait', 'landscape')),
  margins JSONB DEFAULT '{"top": 20, "right": 20, "bottom": 30, "left": 20}',
  
  -- Localization defaults (can be overridden)
  default_language TEXT DEFAULT 'en',
  date_format TEXT DEFAULT 'YYYY-MM-DD',
  number_format JSONB DEFAULT '{"decimal": ".", "thousand": ",", "precision": 2}',
  
  -- Regulatory compliance
  legal_disclosures JSONB DEFAULT '[]',
  required_footnotes JSONB DEFAULT '[]',
  registration_fields JSONB DEFAULT '[]',
  
  -- Versioning
  version INTEGER NOT NULL DEFAULT 1,
  effective_date DATE DEFAULT CURRENT_DATE,
  status template_status DEFAULT 'active',
  
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Partial unique indexes for template uniqueness across hierarchy levels
CREATE UNIQUE INDEX idx_print_templates_base_unique 
  ON public.print_templates(code, version) 
  WHERE country_id IS NULL AND organization_id IS NULL;

CREATE UNIQUE INDEX idx_print_templates_country_unique 
  ON public.print_templates(code, version, country_id) 
  WHERE country_id IS NOT NULL AND organization_id IS NULL;

CREATE UNIQUE INDEX idx_print_templates_org_unique 
  ON public.print_templates(code, version, organization_id) 
  WHERE organization_id IS NOT NULL;

-- Template version history for audit trail
CREATE TABLE public.print_template_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.print_templates(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  content_snapshot JSONB NOT NULL,
  regulatory_version TEXT,
  change_notes TEXT,
  effective_date DATE NOT NULL,
  locked_at TIMESTAMPTZ,
  locked_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  
  UNIQUE(template_id, version)
);

-- =============================================
-- BRANDING & IDENTITY
-- =============================================

-- Organization print profiles (extends existing branding)
CREATE TABLE public.print_brand_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE UNIQUE,
  
  -- Logo and branding
  logo_url TEXT,
  logo_width INTEGER DEFAULT 60,
  logo_position TEXT DEFAULT 'left' CHECK (logo_position IN ('left', 'center', 'right')),
  
  -- Header defaults
  header_style JSONB DEFAULT '{}',
  show_address BOOLEAN DEFAULT true,
  show_contact BOOLEAN DEFAULT true,
  show_website BOOLEAN DEFAULT true,
  
  -- Footer defaults  
  footer_style JSONB DEFAULT '{}',
  footer_text TEXT,
  show_page_numbers BOOLEAN DEFAULT true,
  page_number_format TEXT DEFAULT 'Page {page} of {pages}',
  
  -- Watermarks
  draft_watermark_text TEXT DEFAULT 'DRAFT',
  confidential_watermark_text TEXT DEFAULT 'CONFIDENTIAL',
  watermark_opacity NUMERIC DEFAULT 0.15,
  
  -- Signatures
  authorized_signature_url TEXT,
  signature_title TEXT,
  signature_name TEXT,
  
  -- Colors and fonts
  primary_color TEXT DEFAULT '#1e40af',
  secondary_color TEXT DEFAULT '#64748b',
  font_family TEXT DEFAULT 'Helvetica',
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- GENERATED DOCUMENTS ARCHIVE
-- =============================================

-- Store generated PDF metadata for audit and retrieval
CREATE TABLE public.print_document_archive (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  -- Document identification
  document_type print_document_type NOT NULL,
  document_title TEXT NOT NULL,
  document_reference TEXT,
  source_record_id UUID,
  source_record_type TEXT,
  
  -- Period and compliance
  reporting_period_start DATE,
  reporting_period_end DATE,
  fiscal_year INTEGER,
  country_id UUID REFERENCES public.countries(id),
  
  -- Template used
  template_id UUID REFERENCES public.print_templates(id),
  template_version INTEGER,
  
  -- Storage
  storage_path TEXT,
  file_size_bytes INTEGER,
  checksum TEXT,
  
  -- Localization
  language TEXT DEFAULT 'en',
  currency TEXT DEFAULT 'CAD',
  
  -- Classification
  is_draft BOOLEAN DEFAULT false,
  is_confidential BOOLEAN DEFAULT false,
  is_final BOOLEAN DEFAULT false,
  
  -- Tags for searching
  tags TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  
  -- Audit
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  generated_by UUID REFERENCES auth.users(id),
  expires_at TIMESTAMPTZ
);

-- =============================================
-- PRINT AUDIT LOG
-- =============================================

-- Comprehensive audit trail for all print/PDF actions
CREATE TABLE public.print_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  
  -- Action details
  action_type print_action_type NOT NULL,
  document_type print_document_type NOT NULL,
  document_title TEXT,
  document_reference TEXT,
  
  -- Source tracking
  source_record_id UUID,
  source_record_type TEXT,
  archive_document_id UUID REFERENCES public.print_document_archive(id),
  
  -- Template tracking
  template_id UUID REFERENCES public.print_templates(id),
  template_version INTEGER,
  
  -- User and session
  performed_by UUID REFERENCES auth.users(id),
  performed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address INET,
  user_agent TEXT,
  
  -- Output details
  output_type TEXT CHECK (output_type IN ('browser_print', 'pdf_download', 'pdf_storage', 'preview')),
  paper_size paper_size,
  orientation TEXT,
  page_count INTEGER,
  
  -- Localization used
  language TEXT,
  currency TEXT,
  country_id UUID REFERENCES public.countries(id),
  
  -- Additional context
  metadata JSONB DEFAULT '{}'
);

-- =============================================
-- INDEXES
-- =============================================

CREATE INDEX idx_print_templates_doc_type ON public.print_templates(document_type);
CREATE INDEX idx_print_templates_country ON public.print_templates(country_id);
CREATE INDEX idx_print_templates_org ON public.print_templates(organization_id);
CREATE INDEX idx_print_templates_status ON public.print_templates(status);

CREATE INDEX idx_print_archive_org ON public.print_document_archive(organization_id);
CREATE INDEX idx_print_archive_type ON public.print_document_archive(document_type);
CREATE INDEX idx_print_archive_period ON public.print_document_archive(reporting_period_start, reporting_period_end);
CREATE INDEX idx_print_archive_tags ON public.print_document_archive USING GIN(tags);

CREATE INDEX idx_print_audit_org ON public.print_audit_log(organization_id);
CREATE INDEX idx_print_audit_user ON public.print_audit_log(performed_by);
CREATE INDEX idx_print_audit_date ON public.print_audit_log(performed_at DESC);
CREATE INDEX idx_print_audit_type ON public.print_audit_log(document_type);

-- =============================================
-- RLS POLICIES
-- =============================================

ALTER TABLE public.print_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.print_template_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.print_brand_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.print_document_archive ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.print_audit_log ENABLE ROW LEVEL SECURITY;

-- Templates: base templates readable by all, org-specific by members
CREATE POLICY "Base templates are viewable by all authenticated"
  ON public.print_templates FOR SELECT TO authenticated
  USING (organization_id IS NULL OR public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Organization members can manage their templates"
  ON public.print_templates FOR ALL TO authenticated
  USING (organization_id IS NOT NULL AND public.is_org_member(auth.uid(), organization_id));

-- Template versions: same as templates
CREATE POLICY "Template versions viewable by template viewers"
  ON public.print_template_versions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.print_templates t
      WHERE t.id = template_id
      AND (t.organization_id IS NULL OR public.is_org_member(auth.uid(), t.organization_id))
    )
  );

-- Brand profiles: org members only
CREATE POLICY "Brand profiles managed by org members"
  ON public.print_brand_profiles FOR ALL TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));

-- Document archive: org members only
CREATE POLICY "Document archive accessible by org members"
  ON public.print_document_archive FOR ALL TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));

-- Audit log: viewable by org admins/owners
CREATE POLICY "Audit log viewable by org admins"
  ON public.print_audit_log FOR SELECT TO authenticated
  USING (public.is_org_admin_or_owner(organization_id, auth.uid()));

CREATE POLICY "Audit log insertable by org members"
  ON public.print_audit_log FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));

-- =============================================
-- TRIGGERS
-- =============================================

CREATE OR REPLACE FUNCTION public.update_print_template_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_print_templates_updated
  BEFORE UPDATE ON public.print_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_print_template_updated_at();

CREATE TRIGGER trg_print_brand_profiles_updated
  BEFORE UPDATE ON public.print_brand_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_print_template_updated_at();