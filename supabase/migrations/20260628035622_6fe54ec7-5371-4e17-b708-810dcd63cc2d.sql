
CREATE OR REPLACE VIEW public.v_je_lines_with_division
WITH (security_invoker = true) AS
SELECT
  jel.*,
  COALESCE(jel.department_id, je.department_id) AS effective_department_id,
  je.entry_date,
  je.status AS je_status,
  je.organization_id AS je_organization_id
FROM public.journal_entry_lines jel
JOIN public.journal_entries je ON je.id = jel.journal_entry_id;

GRANT SELECT ON public.v_je_lines_with_division TO authenticated;
GRANT SELECT ON public.v_je_lines_with_division TO service_role;

CREATE OR REPLACE FUNCTION public.user_can_access_division(_user uuid, _dept uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    CASE
      WHEN _dept IS NULL THEN true
      WHEN NOT EXISTS (SELECT 1 FROM public.user_division_access WHERE user_id = _user) THEN true
      WHEN EXISTS (SELECT 1 FROM public.user_division_access WHERE user_id = _user AND department_id = _dept) THEN true
      ELSE false
    END;
$$;
GRANT EXECUTE ON FUNCTION public.user_can_access_division(uuid, uuid) TO authenticated;

ALTER TABLE public.budget_line_items
  ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_budget_line_items_department ON public.budget_line_items(department_id);

CREATE TABLE IF NOT EXISTS public.allocation_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  rule_id uuid NOT NULL REFERENCES public.allocation_rules(id) ON DELETE CASCADE,
  frequency text NOT NULL CHECK (frequency IN ('monthly', 'quarterly')),
  day_of_period integer NOT NULL DEFAULT 1 CHECK (day_of_period BETWEEN 1 AND 31),
  next_run_at timestamptz NOT NULL DEFAULT now(),
  last_run_at timestamptz,
  last_run_status text,
  last_run_error text,
  active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.allocation_schedules TO authenticated;
GRANT ALL ON public.allocation_schedules TO service_role;

ALTER TABLE public.allocation_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view org allocation schedules"
ON public.allocation_schedules FOR SELECT TO authenticated
USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Members can manage org allocation schedules"
ON public.allocation_schedules FOR ALL TO authenticated
USING (public.is_org_member(auth.uid(), organization_id))
WITH CHECK (public.is_org_member(auth.uid(), organization_id));

CREATE INDEX IF NOT EXISTS idx_alloc_sched_due
  ON public.allocation_schedules(next_run_at) WHERE active = true;

CREATE OR REPLACE FUNCTION public.set_updated_at_alloc_schedules()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_alloc_sched_upd ON public.allocation_schedules;
CREATE TRIGGER trg_alloc_sched_upd
  BEFORE UPDATE ON public.allocation_schedules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_alloc_schedules();
