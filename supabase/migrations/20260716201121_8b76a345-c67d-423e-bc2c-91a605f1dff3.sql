CREATE TABLE public.ai_categorization_settings (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  auto_apply_enabled boolean NOT NULL DEFAULT false,
  auto_apply_threshold integer NOT NULL DEFAULT 95 CHECK (auto_apply_threshold BETWEEN 50 AND 100),
  auto_apply_scopes text[] NOT NULL DEFAULT ARRAY[]::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.ai_categorization_settings TO authenticated;
GRANT ALL ON public.ai_categorization_settings TO service_role;
ALTER TABLE public.ai_categorization_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members read ai cat settings"
  ON public.ai_categorization_settings FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "org admins write ai cat settings"
  ON public.ai_categorization_settings FOR ALL TO authenticated
  USING (public.is_org_admin_or_owner(organization_id, auth.uid()))
  WITH CHECK (public.is_org_admin_or_owner(organization_id, auth.uid()));

CREATE TRIGGER trg_ai_cat_settings_updated_at
  BEFORE UPDATE ON public.ai_categorization_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();