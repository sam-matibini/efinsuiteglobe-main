-- Organization API keys and receptionist activity share the communication
-- contact directory. Org owners can save keys without platform_settings.

CREATE TABLE IF NOT EXISTS public.organization_api_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('elevenlabs', 'custom')),
  name text NOT NULL,
  secret_name text NOT NULL,
  api_key text NOT NULL,
  key_hint text NOT NULL,
  status text NOT NULL DEFAULT 'saved',
  last_error text,
  last_tested_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, secret_name)
);

CREATE TABLE IF NOT EXISTS public.receptionist_settings (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  answering boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.receptionist_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.communication_contacts(id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind IN ('call', 'handoff', 'booking', 'message')),
  body text NOT NULL,
  contact_name text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_receptionist_activity_org
  ON public.receptionist_activity (organization_id, created_at DESC);

ALTER TABLE public.organization_api_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receptionist_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receptionist_activity ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_org_owner_or_admin(_org uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members
    WHERE organization_id = _org
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
  );
$$;

REVOKE ALL ON FUNCTION public.is_org_owner_or_admin(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_org_owner_or_admin(uuid) TO authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_api_credentials TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.receptionist_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.receptionist_activity TO authenticated;
GRANT ALL ON public.organization_api_credentials TO service_role;
GRANT ALL ON public.receptionist_settings TO service_role;
GRANT ALL ON public.receptionist_activity TO service_role;

DROP POLICY IF EXISTS "org admins read api credentials" ON public.organization_api_credentials;
CREATE POLICY "org admins read api credentials"
  ON public.organization_api_credentials FOR SELECT TO authenticated
  USING (public.is_org_owner_or_admin(organization_id));

DROP POLICY IF EXISTS "org admins insert api credentials" ON public.organization_api_credentials;
CREATE POLICY "org admins insert api credentials"
  ON public.organization_api_credentials FOR INSERT TO authenticated
  WITH CHECK (public.is_org_owner_or_admin(organization_id));

DROP POLICY IF EXISTS "org admins update api credentials" ON public.organization_api_credentials;
CREATE POLICY "org admins update api credentials"
  ON public.organization_api_credentials FOR UPDATE TO authenticated
  USING (public.is_org_owner_or_admin(organization_id))
  WITH CHECK (public.is_org_owner_or_admin(organization_id));

DROP POLICY IF EXISTS "org admins delete api credentials" ON public.organization_api_credentials;
CREATE POLICY "org admins delete api credentials"
  ON public.organization_api_credentials FOR DELETE TO authenticated
  USING (public.is_org_owner_or_admin(organization_id));

DROP POLICY IF EXISTS "members read receptionist settings" ON public.receptionist_settings;
CREATE POLICY "members read receptionist settings"
  ON public.receptionist_settings FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_id = receptionist_settings.organization_id
        AND user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "members write receptionist settings" ON public.receptionist_settings;
CREATE POLICY "members write receptionist settings"
  ON public.receptionist_settings FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_id = receptionist_settings.organization_id
        AND user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "members update receptionist settings" ON public.receptionist_settings;
CREATE POLICY "members update receptionist settings"
  ON public.receptionist_settings FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_id = receptionist_settings.organization_id
        AND user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "members read receptionist activity" ON public.receptionist_activity;
CREATE POLICY "members read receptionist activity"
  ON public.receptionist_activity FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_id = receptionist_activity.organization_id
        AND user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "members insert receptionist activity" ON public.receptionist_activity;
CREATE POLICY "members insert receptionist activity"
  ON public.receptionist_activity FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_id = receptionist_activity.organization_id
        AND user_id = auth.uid()
    )
  );
