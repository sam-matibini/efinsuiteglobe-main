
CREATE TABLE public.employee_guarantors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  guarantor_order SMALLINT NOT NULL CHECK (guarantor_order IN (1,2)),
  full_name TEXT NOT NULL,
  sex TEXT,
  phone_number TEXT,
  email TEXT,
  marital_status TEXT,
  relationship TEXT,
  profession TEXT,
  residential_address TEXT,
  residential_city TEXT,
  residential_postal_code TEXT,
  residential_state TEXT,
  residential_country TEXT,
  office_address TEXT,
  office_city TEXT,
  office_postal_code TEXT,
  office_state TEXT,
  office_country TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employee_id, guarantor_order)
);

CREATE INDEX idx_employee_guarantors_employee ON public.employee_guarantors(employee_id);
CREATE INDEX idx_employee_guarantors_org ON public.employee_guarantors(organization_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_guarantors TO authenticated;
GRANT ALL ON public.employee_guarantors TO service_role;

ALTER TABLE public.employee_guarantors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view guarantors"
  ON public.employee_guarantors FOR SELECT
  TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members can insert guarantors"
  ON public.employee_guarantors FOR INSERT
  TO authenticated
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members can update guarantors"
  ON public.employee_guarantors FOR UPDATE
  TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id))
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members can delete guarantors"
  ON public.employee_guarantors FOR DELETE
  TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE TRIGGER trg_employee_guarantors_updated_at
  BEFORE UPDATE ON public.employee_guarantors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
