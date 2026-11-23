-- Optional Time & Attendance. Companies that leave it off keep the existing payroll workflow.
-- The company switch lives in time_attendance_settings.enabled (default false),
-- so payroll does not depend on a new modules-catalog enum value.

CREATE TABLE IF NOT EXISTS public.time_attendance_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  clock_in_out_enabled BOOLEAN NOT NULL DEFAULT true,
  payroll_integration BOOLEAN NOT NULL DEFAULT true,
  manager_approval_required BOOLEAN NOT NULL DEFAULT true,
  overtime_enabled BOOLEAN NOT NULL DEFAULT true,
  break_tracking_enabled BOOLEAN NOT NULL DEFAULT true,
  break_mode TEXT NOT NULL DEFAULT 'unpaid',
  auto_break_minutes INTEGER NOT NULL DEFAULT 30,
  timezone TEXT NOT NULL DEFAULT 'America/Toronto',
  allow_unresolved_payroll BOOLEAN NOT NULL DEFAULT false,
  daily_regular_limit NUMERIC(6,2) NOT NULL DEFAULT 8,
  weekly_regular_limit NUMERIC(6,2) NOT NULL DEFAULT 40,
  overtime_multiplier NUMERIC(6,2) NOT NULL DEFAULT 1.5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.employee_time_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  enabled BOOLEAN,
  clock_in_required BOOLEAN NOT NULL DEFAULT true,
  clock_out_required BOOLEAN NOT NULL DEFAULT true,
  schedule JSONB NOT NULL DEFAULT '[]'::jsonb,
  break_minutes INTEGER NOT NULL DEFAULT 30,
  overtime_rule TEXT NOT NULL DEFAULT 'company_default',
  pay_type TEXT NOT NULL DEFAULT 'hourly',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, employee_id)
);

CREATE TABLE IF NOT EXISTS public.employee_time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  work_date DATE NOT NULL,
  clock_in TIMESTAMPTZ NOT NULL,
  clock_out TIMESTAMPTZ,
  timezone TEXT NOT NULL,
  break_minutes INTEGER NOT NULL DEFAULT 0,
  gross_hours NUMERIC(8,2) NOT NULL DEFAULT 0,
  paid_hours NUMERIC(8,2) NOT NULL DEFAULT 0,
  regular_hours NUMERIC(8,2) NOT NULL DEFAULT 0,
  overtime_hours NUMERIC(8,2) NOT NULL DEFAULT 0,
  holiday_hours NUMERIC(8,2) NOT NULL DEFAULT 0,
  vacation_hours NUMERIC(8,2) NOT NULL DEFAULT 0,
  sick_hours NUMERIC(8,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  source TEXT NOT NULL,
  notes TEXT,
  breaks JSONB NOT NULL DEFAULT '[]'::jsonb,
  original_clock_in TIMESTAMPTZ,
  original_clock_out TIMESTAMPTZ,
  employee_name TEXT,
  department TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS one_open_time_entry_per_employee
  ON public.employee_time_entries (employee_id)
  WHERE status = 'OPEN';

CREATE TABLE IF NOT EXISTS public.time_entry_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  time_entry_id UUID NOT NULL REFERENCES public.employee_time_entries(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  original_value TEXT NOT NULL,
  new_value TEXT NOT NULL,
  reason TEXT NOT NULL,
  adjusted_by TEXT NOT NULL,
  adjusted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.time_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  time_entry_id UUID NOT NULL REFERENCES public.employee_time_entries(id) ON DELETE CASCADE,
  approver_id TEXT NOT NULL,
  status TEXT NOT NULL,
  comments TEXT,
  approved_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payroll_time_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_run_id TEXT NOT NULL,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  regular_hours NUMERIC(8,2) NOT NULL DEFAULT 0,
  overtime_hours NUMERIC(8,2) NOT NULL DEFAULT 0,
  holiday_hours NUMERIC(8,2) NOT NULL DEFAULT 0,
  vacation_hours NUMERIC(8,2) NOT NULL DEFAULT 0,
  sick_hours NUMERIC(8,2) NOT NULL DEFAULT 0,
  total_hours NUMERIC(8,2) NOT NULL DEFAULT 0,
  entry_ids UUID[] NOT NULL DEFAULT '{}',
  daily JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.time_attendance_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  at TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_id TEXT NOT NULL,
  role TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  detail TEXT NOT NULL
);

ALTER TABLE public.time_attendance_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_time_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_entry_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_time_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_attendance_audit ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.time_attendance_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_time_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_time_entries TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.time_entry_adjustments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.time_approvals TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll_time_summary TO authenticated;
GRANT SELECT, INSERT ON public.time_attendance_audit TO authenticated;

CREATE POLICY "Org payroll roles manage time settings"
  ON public.time_attendance_settings FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin', 'finance_manager', 'payroll_officer', 'hr', 'manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin', 'finance_manager', 'payroll_officer', 'hr', 'manager')
    )
  );

CREATE POLICY "Employees and payroll roles see time entries"
  ON public.employee_time_entries FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.id = employee_id
        AND LOWER(e.email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
    )
    OR EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin', 'finance_manager', 'payroll_officer', 'hr', 'manager')
    )
  );

CREATE POLICY "Employees can clock themselves"
  ON public.employee_time_entries FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.id = employee_id
        AND e.organization_id = organization_id
        AND LOWER(e.email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
    )
    OR EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin', 'finance_manager', 'payroll_officer', 'hr', 'manager')
    )
  );

CREATE POLICY "Employees and payroll roles update time entries"
  ON public.employee_time_entries FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.id = employee_id
        AND LOWER(e.email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
    )
    OR EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin', 'finance_manager', 'payroll_officer', 'hr', 'manager')
    )
  );

CREATE POLICY "Org members read employee time settings"
  ON public.employee_time_settings FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = organization_id AND om.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.id = employee_id
        AND LOWER(e.email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
    )
  );

CREATE POLICY "Payroll roles manage employee time settings"
  ON public.employee_time_settings FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin', 'finance_manager', 'payroll_officer', 'hr', 'manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin', 'finance_manager', 'payroll_officer', 'hr', 'manager')
    )
  );

CREATE POLICY "Payroll roles read adjustments"
  ON public.time_entry_adjustments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.employee_time_entries te
      JOIN public.organization_members om ON om.organization_id = te.organization_id
      WHERE te.id = time_entry_id AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "Payroll roles insert adjustments"
  ON public.time_entry_adjustments FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.employee_time_entries te
      JOIN public.organization_members om ON om.organization_id = te.organization_id
      WHERE te.id = time_entry_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin', 'finance_manager', 'payroll_officer', 'hr', 'manager')
    )
  );

CREATE POLICY "Org members read approvals"
  ON public.time_approvals FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.employee_time_entries te
      JOIN public.organization_members om ON om.organization_id = te.organization_id
      WHERE te.id = time_entry_id AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "Payroll roles insert approvals"
  ON public.time_approvals FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.employee_time_entries te
      JOIN public.organization_members om ON om.organization_id = te.organization_id
      WHERE te.id = time_entry_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin', 'finance_manager', 'payroll_officer', 'hr', 'manager')
    )
  );

CREATE POLICY "Payroll roles manage payroll time summary"
  ON public.payroll_time_summary FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.employees e
      JOIN public.organization_members om ON om.organization_id = e.organization_id
      WHERE e.id = employee_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin', 'finance_manager', 'payroll_officer', 'hr', 'manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.employees e
      JOIN public.organization_members om ON om.organization_id = e.organization_id
      WHERE e.id = employee_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin', 'finance_manager', 'payroll_officer', 'hr', 'manager')
    )
  );

CREATE POLICY "Org members read time audit"
  ON public.time_attendance_audit FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = organization_id AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "Org members read company time settings"
  ON public.time_attendance_settings FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = organization_id AND om.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.organization_id = organization_id
        AND LOWER(e.email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
    )
  );

CREATE POLICY "Employees can request a time correction"
  ON public.time_entry_adjustments FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.employee_time_entries te
      JOIN public.employees e ON e.id = te.employee_id
      WHERE te.id = time_entry_id
        AND LOWER(e.email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
    )
  );

CREATE POLICY "Accountants read payroll time"
  ON public.employee_time_entries FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = organization_id
        AND om.user_id = auth.uid()
        AND om.role = 'accountant'
    )
  );

CREATE POLICY "Org members insert time audit"
  ON public.time_attendance_audit FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = organization_id AND om.user_id = auth.uid()
    )
  );
