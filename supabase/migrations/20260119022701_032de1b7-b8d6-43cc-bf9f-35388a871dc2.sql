-- ============================================================================
-- Trial Balance & Opening Balance Import Engine
-- Comprehensive import system for migration, year-end rollovers, and consolidations
-- ============================================================================

-- 1. Import batches - tracks each import session
CREATE TABLE public.import_batches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  -- Import configuration
  import_type TEXT NOT NULL CHECK (import_type IN ('trial_balance', 'opening_balance')),
  posting_mode TEXT NOT NULL DEFAULT 'opening_balance' CHECK (posting_mode IN ('opening_balance', 'journal_entry')),
  source_system TEXT, -- QuickBooks, Sage, Xero, SAP, Oracle, Dynamics, Custom
  
  -- Period information
  fiscal_year TEXT NOT NULL,
  period_start DATE,
  period_end DATE,
  as_of_date DATE NOT NULL,
  
  -- Currency & FX
  base_currency TEXT NOT NULL DEFAULT 'CAD',
  source_currency TEXT,
  exchange_rate NUMERIC(18,8) DEFAULT 1.0,
  fx_source TEXT CHECK (fx_source IN ('source', 'system', 'manual')),
  
  -- Entity information
  entity_id UUID REFERENCES public.budget_hierarchy(id),
  country_id UUID REFERENCES public.countries(id),
  
  -- File information
  original_filename TEXT,
  file_hash TEXT, -- For idempotent import / duplicate detection
  file_size_bytes INTEGER,
  total_rows INTEGER DEFAULT 0,
  
  -- Mapping configuration (stored as JSONB)
  column_mappings JSONB,
  date_format TEXT DEFAULT 'auto',
  number_format TEXT DEFAULT 'standard',
  invert_signs BOOLEAN DEFAULT false,
  treat_brackets_as_negative BOOLEAN DEFAULT true,
  
  -- Validation results
  validation_status TEXT DEFAULT 'pending' CHECK (validation_status IN ('pending', 'valid', 'invalid', 'warnings')),
  validation_errors JSONB DEFAULT '[]'::jsonb,
  validation_warnings JSONB DEFAULT '[]'::jsonb,
  
  -- Reconciliation totals (from source)
  source_total_debits NUMERIC(18,2) DEFAULT 0,
  source_total_credits NUMERIC(18,2) DEFAULT 0,
  source_balance_difference NUMERIC(18,2) DEFAULT 0,
  
  -- Posted totals
  posted_total_debits NUMERIC(18,2) DEFAULT 0,
  posted_total_credits NUMERIC(18,2) DEFAULT 0,
  
  -- Status & workflow
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'validating', 'validated', 'posting', 'posted', 'reversed', 'failed')),
  
  -- Audit
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  posted_at TIMESTAMPTZ,
  posted_by UUID REFERENCES auth.users(id),
  reversed_at TIMESTAMPTZ,
  reversed_by UUID REFERENCES auth.users(id),
  reversal_reason TEXT,
  
  -- Journal entries created
  journal_entry_ids UUID[] DEFAULT '{}',
  reversal_journal_entry_ids UUID[] DEFAULT '{}'
);

-- 2. Import rows - individual line items from the import
CREATE TABLE public.import_batch_rows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_id UUID NOT NULL REFERENCES public.import_batches(id) ON DELETE CASCADE,
  row_number INTEGER NOT NULL,
  
  -- Raw data from file
  raw_data JSONB NOT NULL,
  
  -- Parsed values
  account_code TEXT,
  account_name TEXT,
  debit_amount NUMERIC(18,2) DEFAULT 0,
  credit_amount NUMERIC(18,2) DEFAULT 0,
  net_balance NUMERIC(18,2) DEFAULT 0,
  
  -- Currency info
  currency TEXT,
  source_amount NUMERIC(18,2),
  converted_amount NUMERIC(18,2),
  exchange_rate NUMERIC(18,8),
  
  -- Optional dimensions
  department TEXT,
  cost_center TEXT,
  project TEXT,
  fund TEXT,
  location TEXT,
  program TEXT,
  
  -- Account matching
  matched_account_id UUID REFERENCES public.accounts(id),
  match_type TEXT CHECK (match_type IN ('exact', 'alias', 'fuzzy', 'manual', 'unmatched', 'create_new')),
  match_confidence NUMERIC(5,2),
  match_suggestions JSONB DEFAULT '[]'::jsonb,
  
  -- Validation
  is_valid BOOLEAN DEFAULT true,
  validation_errors JSONB DEFAULT '[]'::jsonb,
  validation_warnings JSONB DEFAULT '[]'::jsonb,
  
  -- Posting status
  is_posted BOOLEAN DEFAULT false,
  posted_at TIMESTAMPTZ,
  journal_entry_line_id UUID REFERENCES public.journal_entry_lines(id),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Account aliases for legacy code mapping
CREATE TABLE public.account_aliases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  
  alias_code TEXT NOT NULL,
  alias_name TEXT,
  source_system TEXT, -- Which system this alias came from
  
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(organization_id, alias_code)
);

-- 4. Import mapping templates (extends existing statement_mapping_templates concept)
CREATE TABLE public.import_mapping_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  name TEXT NOT NULL,
  import_type TEXT NOT NULL CHECK (import_type IN ('trial_balance', 'opening_balance')),
  source_system TEXT,
  
  -- Column mappings
  mappings JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Format settings
  date_format TEXT DEFAULT 'auto',
  number_format TEXT DEFAULT 'standard',
  invert_signs BOOLEAN DEFAULT false,
  treat_brackets_as_negative BOOLEAN DEFAULT true,
  
  -- Default values
  default_currency TEXT,
  default_entity_id UUID,
  
  is_default BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Import audit log - detailed tracking
CREATE TABLE public.import_audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_id UUID NOT NULL REFERENCES public.import_batches(id) ON DELETE CASCADE,
  
  action TEXT NOT NULL,
  details JSONB,
  
  performed_by UUID REFERENCES auth.users(id),
  performed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address TEXT,
  user_agent TEXT
);

-- Indexes for performance
CREATE INDEX idx_import_batches_org ON public.import_batches(organization_id);
CREATE INDEX idx_import_batches_status ON public.import_batches(status);
CREATE INDEX idx_import_batches_fiscal_year ON public.import_batches(fiscal_year);
CREATE INDEX idx_import_batch_rows_batch ON public.import_batch_rows(batch_id);
CREATE INDEX idx_import_batch_rows_account ON public.import_batch_rows(matched_account_id);
CREATE INDEX idx_import_batch_rows_valid ON public.import_batch_rows(batch_id, is_valid);
CREATE INDEX idx_account_aliases_org ON public.account_aliases(organization_id);
CREATE INDEX idx_account_aliases_code ON public.account_aliases(organization_id, alias_code);
CREATE INDEX idx_import_mapping_templates_org ON public.import_mapping_templates(organization_id);
CREATE INDEX idx_import_audit_logs_batch ON public.import_audit_logs(batch_id);

-- RLS Policies
ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_batch_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_mapping_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_audit_logs ENABLE ROW LEVEL SECURITY;

-- Import batches RLS
CREATE POLICY "Users can view their organization's import batches"
  ON public.import_batches FOR SELECT
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Users can create import batches for their organization"
  ON public.import_batches FOR INSERT
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Users can update their organization's import batches"
  ON public.import_batches FOR UPDATE
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Users can delete their organization's draft import batches"
  ON public.import_batches FOR DELETE
  USING (public.is_org_member(auth.uid(), organization_id) AND status = 'draft');

-- Import batch rows RLS (inherits from batch)
CREATE POLICY "Users can view import rows via batch"
  ON public.import_batch_rows FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.import_batches b 
    WHERE b.id = batch_id AND public.is_org_member(auth.uid(), b.organization_id)
  ));

CREATE POLICY "Users can create import rows via batch"
  ON public.import_batch_rows FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.import_batches b 
    WHERE b.id = batch_id AND public.is_org_member(auth.uid(), b.organization_id)
  ));

CREATE POLICY "Users can update import rows via batch"
  ON public.import_batch_rows FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.import_batches b 
    WHERE b.id = batch_id AND public.is_org_member(auth.uid(), b.organization_id)
  ));

CREATE POLICY "Users can delete import rows via batch"
  ON public.import_batch_rows FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.import_batches b 
    WHERE b.id = batch_id AND public.is_org_member(auth.uid(), b.organization_id) AND b.status = 'draft'
  ));

-- Account aliases RLS
CREATE POLICY "Users can view their organization's account aliases"
  ON public.account_aliases FOR SELECT
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Users can manage their organization's account aliases"
  ON public.account_aliases FOR ALL
  USING (public.is_org_member(auth.uid(), organization_id));

-- Import mapping templates RLS
CREATE POLICY "Users can view their organization's import templates"
  ON public.import_mapping_templates FOR SELECT
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Users can manage their organization's import templates"
  ON public.import_mapping_templates FOR ALL
  USING (public.is_org_member(auth.uid(), organization_id));

-- Import audit logs RLS
CREATE POLICY "Users can view audit logs via batch"
  ON public.import_audit_logs FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.import_batches b 
    WHERE b.id = batch_id AND public.is_org_member(auth.uid(), b.organization_id)
  ));

CREATE POLICY "System can create audit logs"
  ON public.import_audit_logs FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.import_batches b 
    WHERE b.id = batch_id AND public.is_org_member(auth.uid(), b.organization_id)
  ));

-- Updated_at triggers
CREATE TRIGGER update_import_batches_updated_at
  BEFORE UPDATE ON public.import_batches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_import_batch_rows_updated_at
  BEFORE UPDATE ON public.import_batch_rows
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_account_aliases_updated_at
  BEFORE UPDATE ON public.account_aliases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_import_mapping_templates_updated_at
  BEFORE UPDATE ON public.import_mapping_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();