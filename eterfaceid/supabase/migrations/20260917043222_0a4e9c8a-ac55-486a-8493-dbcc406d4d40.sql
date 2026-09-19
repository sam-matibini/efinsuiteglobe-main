ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS live_access text NOT NULL DEFAULT 'locked',
  ADD COLUMN IF NOT EXISTS live_approved_at timestamptz;

ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_live_access_check
  CHECK (live_access IN ('locked','approved','suspended'));

CREATE TABLE public.org_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  legal_name text NOT NULL,
  registration_number text,
  country text,
  address_line1 text,
  city text,
  region text,
  postal_code text,
  website text,
  contact_name text,
  contact_email text,
  contact_phone text,
  use_case text,
  expected_volume integer,
  owners jsonb NOT NULL DEFAULT '[]'::jsonb,
  verification jsonb NOT NULL DEFAULT '{}'::jsonb,
  verification_result check_result NOT NULL DEFAULT 'not_run',
  status text NOT NULL DEFAULT 'pending',
  reviewer_id uuid REFERENCES auth.users(id),
  reviewer_note text,
  reviewed_at timestamptz,
  submitted_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT org_applications_status_check CHECK (status IN ('draft','pending','approved','declined'))
);
CREATE UNIQUE INDEX org_applications_org_open_idx ON public.org_applications (org_id) WHERE status IN ('draft','pending');
CREATE INDEX org_applications_status_idx ON public.org_applications (status, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.org_applications TO authenticated;
GRANT ALL ON public.org_applications TO service_role;
ALTER TABLE public.org_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read their own application" ON public.org_applications
  FOR SELECT TO authenticated USING (public.is_org_member(org_id) OR public.is_platform_staff());
CREATE POLICY "Admins submit an application" ON public.org_applications
  FOR INSERT TO authenticated WITH CHECK (public.has_org_role(org_id, 'admin'));
CREATE POLICY "Admins or staff update an application" ON public.org_applications
  FOR UPDATE TO authenticated USING (public.has_org_role(org_id, 'admin') OR public.is_platform_staff());

CREATE TABLE public.org_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  version text NOT NULL DEFAULT 'v1',
  method text NOT NULL DEFAULT 'click',
  status text NOT NULL DEFAULT 'accepted',
  accepted_by uuid REFERENCES auth.users(id),
  accepted_name text,
  accepted_email text,
  accepted_ip text,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  document_path text,
  recorded_by uuid REFERENCES auth.users(id),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT org_contracts_method_check CHECK (method IN ('click','signed_copy')),
  CONSTRAINT org_contracts_status_check CHECK (status IN ('accepted','superseded','void'))
);
CREATE INDEX org_contracts_org_idx ON public.org_contracts (org_id, accepted_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.org_contracts TO authenticated;
GRANT ALL ON public.org_contracts TO service_role;
ALTER TABLE public.org_contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read their own contract" ON public.org_contracts
  FOR SELECT TO authenticated USING (public.is_org_member(org_id) OR public.is_platform_staff());
CREATE POLICY "Admins accept a contract" ON public.org_contracts
  FOR INSERT TO authenticated WITH CHECK (public.has_org_role(org_id, 'admin') OR public.is_platform_staff());
CREATE POLICY "Staff update a contract" ON public.org_contracts
  FOR UPDATE TO authenticated USING (public.is_platform_staff());

CREATE TABLE public.api_rate_counters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key_id uuid NOT NULL REFERENCES public.api_keys(id) ON DELETE CASCADE,
  bucket text NOT NULL,
  hits integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT api_rate_counters_unique UNIQUE (key_id, bucket)
);
GRANT ALL ON public.api_rate_counters TO service_role;
ALTER TABLE public.api_rate_counters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read rate counters" ON public.api_rate_counters
  FOR SELECT TO authenticated USING (public.is_platform_staff());

CREATE TRIGGER org_applications_touch BEFORE UPDATE ON public.org_applications
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.bump_rate(_key uuid, _bucket text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare n integer;
begin
  insert into public.api_rate_counters (key_id, bucket, hits) values (_key, _bucket, 1)
  on conflict (key_id, bucket) do update set hits = public.api_rate_counters.hits + 1
  returning hits into n;
  delete from public.api_rate_counters where created_at < now() - interval '1 hour';
  return n;
end;
$$;
REVOKE EXECUTE ON FUNCTION public.bump_rate(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.bump_rate(uuid, text) TO service_role;

UPDATE public.organizations SET live_access = 'approved', live_approved_at = now()
WHERE id = '00000000-0000-4000-8000-000000000001';