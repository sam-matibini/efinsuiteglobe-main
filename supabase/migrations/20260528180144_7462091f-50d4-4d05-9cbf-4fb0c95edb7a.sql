
-- treasury_job_runs
CREATE TABLE public.treasury_job_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid,
  job_name text NOT NULL,
  status text NOT NULL DEFAULT 'running',
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  duration_ms integer,
  error text,
  payload jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.treasury_job_runs TO authenticated;
GRANT ALL ON public.treasury_job_runs TO service_role;
ALTER TABLE public.treasury_job_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members read job runs" ON public.treasury_job_runs
  FOR SELECT TO authenticated
  USING (organization_id IS NULL OR public.is_org_member(organization_id, auth.uid()));
CREATE INDEX idx_treasury_job_runs_org_started ON public.treasury_job_runs(organization_id, started_at DESC);

-- treasury_alerts
CREATE TABLE public.treasury_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  severity text NOT NULL DEFAULT 'info',
  category text NOT NULL,
  title text NOT NULL,
  body text,
  payload jsonb DEFAULT '{}'::jsonb,
  ack_at timestamptz,
  ack_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.treasury_alerts TO authenticated;
GRANT ALL ON public.treasury_alerts TO service_role;
ALTER TABLE public.treasury_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members read alerts" ON public.treasury_alerts
  FOR SELECT TO authenticated USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "org members ack alerts" ON public.treasury_alerts
  FOR UPDATE TO authenticated USING (public.is_org_member(organization_id, auth.uid()));
CREATE INDEX idx_treasury_alerts_org_created ON public.treasury_alerts(organization_id, created_at DESC);

-- us_payment_rail_submissions
CREATE TABLE public.us_payment_rail_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  rail_id uuid NOT NULL,
  submission_type text NOT NULL,
  file_hash text,
  batch_reference text,
  status text NOT NULL DEFAULT 'queued',
  ack jsonb,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);
GRANT SELECT, INSERT, UPDATE ON public.us_payment_rail_submissions TO authenticated;
GRANT ALL ON public.us_payment_rail_submissions TO service_role;
ALTER TABLE public.us_payment_rail_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members read rail submissions" ON public.us_payment_rail_submissions
  FOR SELECT TO authenticated USING (public.is_org_member(organization_id, auth.uid()));

-- auditor_export_runs
CREATE TABLE public.auditor_export_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  bundle_path text,
  status text NOT NULL DEFAULT 'pending',
  error text,
  requested_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
GRANT SELECT, INSERT, UPDATE ON public.auditor_export_runs TO authenticated;
GRANT ALL ON public.auditor_export_runs TO service_role;
ALTER TABLE public.auditor_export_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members read auditor exports" ON public.auditor_export_runs
  FOR SELECT TO authenticated USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "org members create auditor exports" ON public.auditor_export_runs
  FOR INSERT TO authenticated WITH CHECK (public.is_org_member(organization_id, auth.uid()));

-- copilot_messages.tool_trace
ALTER TABLE public.copilot_messages ADD COLUMN IF NOT EXISTS tool_trace jsonb DEFAULT '[]'::jsonb;

-- storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('auditor-bundles', 'auditor-bundles', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "org members read auditor bundles" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'auditor-bundles'
    AND public.is_org_member((storage.foldername(name))[1]::uuid, auth.uid())
  );
CREATE POLICY "service writes auditor bundles" ON storage.objects
  FOR INSERT TO service_role
  WITH CHECK (bucket_id = 'auditor-bundles');
