
-- Allocation Engine
CREATE TABLE IF NOT EXISTS public.allocation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  source_account_id uuid REFERENCES public.accounts(id),
  source_department_id uuid REFERENCES public.departments(id),
  method text NOT NULL CHECK (method IN ('revenue_pct','headcount','fixed_pct','equal','user_count','manual')),
  frequency text NOT NULL DEFAULT 'monthly' CHECK (frequency IN ('monthly','quarterly','annual','on_demand')),
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.allocation_rule_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id uuid NOT NULL REFERENCES public.allocation_rules(id) ON DELETE CASCADE,
  target_department_id uuid NOT NULL REFERENCES public.departments(id),
  weight numeric(18,6) NOT NULL DEFAULT 0,
  driver_metric text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_allocation_targets_rule ON public.allocation_rule_targets(rule_id);

CREATE TABLE IF NOT EXISTS public.allocation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  rule_id uuid REFERENCES public.allocation_rules(id) ON DELETE SET NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','preview','posted','reversed','failed')),
  total_allocated numeric(18,2) NOT NULL DEFAULT 0,
  journal_entry_id uuid REFERENCES public.journal_entries(id),
  reversal_journal_entry_id uuid REFERENCES public.journal_entries(id),
  error_message text,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_allocation_runs_org ON public.allocation_runs(organization_id, period_end);

CREATE TABLE IF NOT EXISTS public.allocation_run_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.allocation_runs(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.accounts(id),
  source_department_id uuid REFERENCES public.departments(id),
  target_department_id uuid NOT NULL REFERENCES public.departments(id),
  source_amount numeric(18,2) NOT NULL DEFAULT 0,
  allocated_amount numeric(18,2) NOT NULL DEFAULT 0,
  driver_value numeric(18,6),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_allocation_run_lines_run ON public.allocation_run_lines(run_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.allocation_rules TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.allocation_rule_targets TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.allocation_runs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.allocation_run_lines TO authenticated;
GRANT ALL ON public.allocation_rules TO service_role;
GRANT ALL ON public.allocation_rule_targets TO service_role;
GRANT ALL ON public.allocation_runs TO service_role;
GRANT ALL ON public.allocation_run_lines TO service_role;

ALTER TABLE public.allocation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.allocation_rule_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.allocation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.allocation_run_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members view allocation rules"
  ON public.allocation_rules FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org admins manage allocation rules"
  ON public.allocation_rules FOR ALL TO authenticated
  USING (public.is_org_admin_or_owner(organization_id, auth.uid()))
  WITH CHECK (public.is_org_admin_or_owner(organization_id, auth.uid()));

CREATE POLICY "Members view targets"
  ON public.allocation_rule_targets FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.allocation_rules r
                 WHERE r.id = rule_id AND public.is_org_member(auth.uid(), r.organization_id)));
CREATE POLICY "Admins manage targets"
  ON public.allocation_rule_targets FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.allocation_rules r
                 WHERE r.id = rule_id AND public.is_org_admin_or_owner(r.organization_id, auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.allocation_rules r
                      WHERE r.id = rule_id AND public.is_org_admin_or_owner(r.organization_id, auth.uid())));

CREATE POLICY "Members view runs"
  ON public.allocation_runs FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "Admins manage runs"
  ON public.allocation_runs FOR ALL TO authenticated
  USING (public.is_org_admin_or_owner(organization_id, auth.uid()))
  WITH CHECK (public.is_org_admin_or_owner(organization_id, auth.uid()));

CREATE POLICY "Members view run lines"
  ON public.allocation_run_lines FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.allocation_runs r
                 WHERE r.id = run_id AND public.is_org_member(auth.uid(), r.organization_id)));
CREATE POLICY "Admins manage run lines"
  ON public.allocation_run_lines FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.allocation_runs r
                 WHERE r.id = run_id AND public.is_org_admin_or_owner(r.organization_id, auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.allocation_runs r
                      WHERE r.id = run_id AND public.is_org_admin_or_owner(r.organization_id, auth.uid())));

DROP TRIGGER IF EXISTS trg_alloc_rules_upd ON public.allocation_rules;
CREATE TRIGGER trg_alloc_rules_upd BEFORE UPDATE ON public.allocation_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_alloc_runs_upd ON public.allocation_runs;
CREATE TRIGGER trg_alloc_runs_upd BEFORE UPDATE ON public.allocation_runs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
