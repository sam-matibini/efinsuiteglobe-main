
CREATE TABLE public.intl_filing_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  jurisdiction text NOT NULL CHECK (jurisdiction IN ('UK','EU')),
  filing_type text NOT NULL CHECK (filing_type IN ('mtd_vat','oss_vat')),
  period_key text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'simulated' CHECK (status IN ('simulated','submitted','failed','accepted','rejected')),
  provider_reference text,
  ack jsonb NOT NULL DEFAULT '{}'::jsonb,
  submitted_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.intl_filing_submissions TO authenticated;
GRANT ALL ON public.intl_filing_submissions TO service_role;
ALTER TABLE public.intl_filing_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "intl_filings_read" ON public.intl_filing_submissions FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "intl_filings_insert" ON public.intl_filing_submissions FOR INSERT TO authenticated WITH CHECK (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "intl_filings_update" ON public.intl_filing_submissions FOR UPDATE TO authenticated USING (public.is_org_member(auth.uid(), organization_id));
CREATE INDEX idx_intl_filings_org ON public.intl_filing_submissions(organization_id, jurisdiction, period_key);

CREATE TABLE public.intl_payment_rail_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  rail_id uuid,
  submission_type text NOT NULL CHECK (submission_type IN ('sepa_credit_transfer','sepa_direct_debit')),
  file_hash text,
  batch_reference text,
  status text NOT NULL DEFAULT 'simulated' CHECK (status IN ('simulated','submitted','failed','acknowledged')),
  ack jsonb NOT NULL DEFAULT '{}'::jsonb,
  entry_count int NOT NULL DEFAULT 0,
  total_amount numeric(18,2) NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.intl_payment_rail_submissions TO authenticated;
GRANT ALL ON public.intl_payment_rail_submissions TO service_role;
ALTER TABLE public.intl_payment_rail_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "intl_rails_read" ON public.intl_payment_rail_submissions FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "intl_rails_insert" ON public.intl_payment_rail_submissions FOR INSERT TO authenticated WITH CHECK (public.is_org_member(auth.uid(), organization_id));

CREATE TABLE public.marketplace_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'other',
  delivery text NOT NULL DEFAULT 'webhook' CHECK (delivery IN ('webhook','rest_pull','sftp','none')),
  config_schema jsonb NOT NULL DEFAULT '{}'::jsonb,
  scopes text[] NOT NULL DEFAULT ARRAY[]::text[],
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.marketplace_integrations TO anon, authenticated;
GRANT ALL ON public.marketplace_integrations TO service_role;
ALTER TABLE public.marketplace_integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "catalog_public_read" ON public.marketplace_integrations FOR SELECT TO anon, authenticated USING (enabled = true);

CREATE TABLE public.org_integration_installations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  integration_id uuid NOT NULL REFERENCES public.marketplace_integrations(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','revoked')),
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  webhook_url text,
  webhook_secret text,
  last_run_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, integration_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_integration_installations TO authenticated;
GRANT ALL ON public.org_integration_installations TO service_role;
ALTER TABLE public.org_integration_installations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "installs_read" ON public.org_integration_installations FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "installs_insert" ON public.org_integration_installations FOR INSERT TO authenticated WITH CHECK (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "installs_update" ON public.org_integration_installations FOR UPDATE TO authenticated USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "installs_delete" ON public.org_integration_installations FOR DELETE TO authenticated USING (public.is_org_member(auth.uid(), organization_id));

CREATE TABLE public.integration_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  installation_id uuid NOT NULL REFERENCES public.org_integration_installations(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL,
  key_prefix text NOT NULL,
  key_hash text NOT NULL,
  label text,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.integration_api_keys TO authenticated;
GRANT ALL ON public.integration_api_keys TO service_role;
ALTER TABLE public.integration_api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "apikeys_read" ON public.integration_api_keys FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "apikeys_insert" ON public.integration_api_keys FOR INSERT TO authenticated WITH CHECK (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "apikeys_update" ON public.integration_api_keys FOR UPDATE TO authenticated USING (public.is_org_member(auth.uid(), organization_id));
CREATE INDEX idx_apikeys_prefix ON public.integration_api_keys(key_prefix) WHERE revoked_at IS NULL;

CREATE TABLE public.integration_event_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  installation_id uuid REFERENCES public.org_integration_installations(id) ON DELETE SET NULL,
  direction text NOT NULL CHECK (direction IN ('inbound','outbound')),
  event_type text NOT NULL,
  status text NOT NULL DEFAULT 'ok',
  http_status int,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  response jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.integration_event_log TO authenticated;
GRANT ALL ON public.integration_event_log TO service_role;
ALTER TABLE public.integration_event_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "eventlog_read" ON public.integration_event_log FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));
CREATE INDEX idx_eventlog_org_time ON public.integration_event_log(organization_id, created_at DESC);

CREATE TABLE public.marketplace_event_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','dispatched','failed')),
  attempts int NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  dispatched_at timestamptz
);
GRANT SELECT ON public.marketplace_event_queue TO authenticated;
GRANT ALL ON public.marketplace_event_queue TO service_role;
ALTER TABLE public.marketplace_event_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "queue_read" ON public.marketplace_event_queue FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));
CREATE INDEX idx_queue_pending ON public.marketplace_event_queue(status, created_at) WHERE status = 'pending';

CREATE OR REPLACE FUNCTION public.enqueue_marketplace_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE evt_type text;
BEGIN
  evt_type := TG_ARGV[0];
  INSERT INTO public.marketplace_event_queue (organization_id, event_type, payload)
  VALUES (NEW.organization_id, evt_type, to_jsonb(NEW));
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='treasury_alerts') THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_enqueue_alert ON public.treasury_alerts';
    EXECUTE 'CREATE TRIGGER trg_enqueue_alert AFTER INSERT ON public.treasury_alerts FOR EACH ROW EXECUTE FUNCTION public.enqueue_marketplace_event(''alert.created'')';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='signed_filings') THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_enqueue_filing ON public.signed_filings';
    EXECUTE 'CREATE TRIGGER trg_enqueue_filing AFTER INSERT ON public.signed_filings FOR EACH ROW EXECUTE FUNCTION public.enqueue_marketplace_event(''filing.submitted'')';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='consolidation_runs') THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_enqueue_consolidation ON public.consolidation_runs';
    EXECUTE 'CREATE TRIGGER trg_enqueue_consolidation AFTER INSERT ON public.consolidation_runs FOR EACH ROW EXECUTE FUNCTION public.enqueue_marketplace_event(''consolidation.completed'')';
  END IF;
END $$;

INSERT INTO public.marketplace_integrations (slug, name, description, category, delivery, scopes, config_schema) VALUES
  ('slack-alerts', 'Slack Alerts', 'Forward treasury alerts to a Slack channel via incoming webhook.', 'notifications', 'webhook',
    ARRAY['alert.created'], '{"fields":[{"key":"webhook_url","label":"Slack Webhook URL","type":"url","required":true}]}'::jsonb),
  ('generic-webhook', 'Generic Webhook', 'Sign and POST treasury events to any HTTPS endpoint (HMAC SHA-256).', 'developer', 'webhook',
    ARRAY['alert.created','filing.submitted','consolidation.completed'],
    '{"fields":[{"key":"webhook_url","label":"HTTPS Endpoint","type":"url","required":true}]}'::jsonb),
  ('google-sheets-export', 'Google Sheets Export', 'Append filing and alert events to a connected Google Sheet (preview).', 'productivity', 'rest_pull',
    ARRAY['filing.submitted'], '{"fields":[{"key":"sheet_id","label":"Sheet ID","type":"text","required":true}]}'::jsonb),
  ('quickbooks-sync', 'QuickBooks Online Sync', 'Sync GL summaries to QuickBooks Online (preview).', 'accounting', 'rest_pull',
    ARRAY['consolidation.completed'], '{"fields":[{"key":"realm_id","label":"QuickBooks Realm ID","type":"text","required":true}]}'::jsonb)
ON CONFLICT (slug) DO NOTHING;
