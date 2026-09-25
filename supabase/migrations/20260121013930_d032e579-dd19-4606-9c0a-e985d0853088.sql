-- Compilation Report Versions table for version control
CREATE TABLE public.compilation_report_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  compilation_report_id UUID NOT NULL REFERENCES public.compilation_reports(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL DEFAULT 1,
  snapshot_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  change_summary TEXT,
  is_locked BOOLEAN DEFAULT false,
  locked_at TIMESTAMP WITH TIME ZONE,
  locked_by UUID REFERENCES auth.users(id),
  UNIQUE(compilation_report_id, version_number)
);

-- Compilation Report Audit Trail table
CREATE TABLE public.compilation_audit_trail (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  compilation_report_id UUID NOT NULL REFERENCES public.compilation_reports(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  action_details JSONB,
  field_changed TEXT,
  old_value TEXT,
  new_value TEXT,
  performed_by UUID REFERENCES auth.users(id),
  performed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ip_address TEXT,
  user_agent TEXT
);

-- Enable RLS
ALTER TABLE public.compilation_report_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compilation_audit_trail ENABLE ROW LEVEL SECURITY;

-- RLS Policies for versions
CREATE POLICY "Users can view versions for their org compilations"
ON public.compilation_report_versions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.compilation_reports cr
    JOIN public.organization_members om ON cr.organization_id = om.organization_id
    WHERE cr.id = compilation_report_id
    AND om.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create versions for their org compilations"
ON public.compilation_report_versions
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.compilation_reports cr
    JOIN public.organization_members om ON cr.organization_id = om.organization_id
    WHERE cr.id = compilation_report_id
    AND om.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update versions for their org compilations"
ON public.compilation_report_versions
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.compilation_reports cr
    JOIN public.organization_members om ON cr.organization_id = om.organization_id
    WHERE cr.id = compilation_report_id
    AND om.user_id = auth.uid()
  )
);

-- RLS Policies for audit trail
CREATE POLICY "Users can view audit trail for their org compilations"
ON public.compilation_audit_trail
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.compilation_reports cr
    JOIN public.organization_members om ON cr.organization_id = om.organization_id
    WHERE cr.id = compilation_report_id
    AND om.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create audit entries for their org compilations"
ON public.compilation_audit_trail
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.compilation_reports cr
    JOIN public.organization_members om ON cr.organization_id = om.organization_id
    WHERE cr.id = compilation_report_id
    AND om.user_id = auth.uid()
  )
);

-- Indexes for performance
CREATE INDEX idx_compilation_versions_report ON public.compilation_report_versions(compilation_report_id);
CREATE INDEX idx_compilation_audit_report ON public.compilation_audit_trail(compilation_report_id);
CREATE INDEX idx_compilation_audit_performed_at ON public.compilation_audit_trail(performed_at DESC);