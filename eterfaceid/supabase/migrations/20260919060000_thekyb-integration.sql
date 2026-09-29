-- The KYB (thekyb.com) complements Plaid: official-registry KYB, UBOs and AML.
INSERT INTO public.integration_settings (provider, label, category, enabled, status)
VALUES ('thekyb', 'The KYB', 'registry', false, 'not_configured')
ON CONFLICT (provider) DO UPDATE
SET label = EXCLUDED.label,
    category = EXCLUDED.category;

CREATE TABLE public.thekyb_profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  kyb_request_id text,
  kyb_response_id text,
  company_name text NOT NULL,
  registration_number text,
  country_code text,
  company_status text,
  company_type text,
  risk_level text,
  verification_status text,
  fetch_status text,
  profile jsonb NOT NULL DEFAULT '{}'::jsonb,
  aml_request_id text,
  aml_match_status text,
  aml_hits jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.thekyb_profiles TO authenticated;
GRANT ALL ON public.thekyb_profiles TO service_role;

ALTER TABLE public.thekyb_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "thekyb_profiles_select" ON public.thekyb_profiles FOR SELECT TO authenticated USING (public.is_org_member(org_id));
CREATE POLICY "thekyb_profiles_insert" ON public.thekyb_profiles FOR INSERT TO authenticated WITH CHECK (public.can_write_org(org_id));
CREATE POLICY "thekyb_profiles_update" ON public.thekyb_profiles FOR UPDATE TO authenticated USING (public.can_write_org(org_id));

CREATE TRIGGER set_org BEFORE INSERT ON public.thekyb_profiles FOR EACH ROW EXECUTE FUNCTION public.set_org_from_case();
CREATE TRIGGER thekyb_profiles_touch BEFORE UPDATE ON public.thekyb_profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX thekyb_profiles_case_idx ON public.thekyb_profiles (case_id);
CREATE INDEX thekyb_profiles_org_idx ON public.thekyb_profiles (org_id);
