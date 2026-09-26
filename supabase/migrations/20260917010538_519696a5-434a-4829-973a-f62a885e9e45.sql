CREATE TABLE public.plaid_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  item_id text NOT NULL,
  access_token text NOT NULL,
  institution_id text,
  institution_name text,
  environment text NOT NULL DEFAULT 'sandbox',
  status text NOT NULL DEFAULT 'active',
  cursor text,
  last_synced_at timestamp with time zone,
  last_error text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (org_id, item_id)
);

GRANT SELECT (id, org_id, case_id, item_id, institution_id, institution_name, environment, status, last_synced_at, last_error, created_by, created_at, updated_at) ON public.plaid_items TO authenticated;
GRANT ALL ON public.plaid_items TO service_role;

ALTER TABLE public.plaid_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plaid_items_select" ON public.plaid_items FOR SELECT TO authenticated USING (public.is_org_member(org_id));

CREATE TRIGGER set_org BEFORE INSERT ON public.plaid_items FOR EACH ROW EXECUTE FUNCTION public.set_org_from_case();
CREATE TRIGGER plaid_items_touch BEFORE UPDATE ON public.plaid_items FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX plaid_items_case_idx ON public.plaid_items (case_id);
CREATE INDEX plaid_items_org_idx ON public.plaid_items (org_id);

CREATE TABLE public.plaid_identity_results (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  item_id uuid REFERENCES public.plaid_items(id) ON DELETE SET NULL,
  institution_name text,
  bank_names text[] NOT NULL DEFAULT '{}',
  bank_emails text[] NOT NULL DEFAULT '{}',
  bank_phones text[] NOT NULL DEFAULT '{}',
  bank_addresses jsonb NOT NULL DEFAULT '[]'::jsonb,
  comparisons jsonb NOT NULL DEFAULT '[]'::jsonb,
  result check_result NOT NULL DEFAULT 'not_run',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.plaid_identity_results TO authenticated;
GRANT ALL ON public.plaid_identity_results TO service_role;

ALTER TABLE public.plaid_identity_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plaid_identity_select" ON public.plaid_identity_results FOR SELECT TO authenticated USING (public.is_org_member(org_id));
CREATE POLICY "plaid_identity_insert" ON public.plaid_identity_results FOR INSERT TO authenticated WITH CHECK (public.can_write_org(org_id));

CREATE TRIGGER set_org BEFORE INSERT ON public.plaid_identity_results FOR EACH ROW EXECUTE FUNCTION public.set_org_from_case();

CREATE INDEX plaid_identity_case_idx ON public.plaid_identity_results (case_id);

INSERT INTO public.integration_settings (provider, label, category, enabled, status)
VALUES ('plaid', 'Plaid', 'banking', false, 'not_configured')
ON CONFLICT (provider) DO NOTHING;