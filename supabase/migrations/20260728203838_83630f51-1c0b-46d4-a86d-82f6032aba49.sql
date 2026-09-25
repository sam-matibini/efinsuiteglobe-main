CREATE TABLE public.job_sites (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL,
  name text NOT NULL,
  code text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_sites TO authenticated;
GRANT ALL ON public.job_sites TO service_role;

ALTER TABLE public.job_sites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view job sites"
  ON public.job_sites FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members can insert job sites"
  ON public.job_sites FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members can update job sites"
  ON public.job_sites FOR UPDATE TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id))
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members can delete job sites"
  ON public.job_sites FOR DELETE TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE TRIGGER update_job_sites_updated_at
  BEFORE UPDATE ON public.job_sites
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.employees
  ADD COLUMN job_site_id uuid REFERENCES public.job_sites(id) ON DELETE RESTRICT;

CREATE INDEX idx_employees_job_site_id ON public.employees(job_site_id);
CREATE INDEX idx_job_sites_organization_id ON public.job_sites(organization_id);