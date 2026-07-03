-- Create timesheet status enum
CREATE TYPE public.timesheet_status AS ENUM ('draft', 'submitted', 'approved', 'rejected', 'processed');

-- Create timesheet entry type enum
CREATE TYPE public.timesheet_entry_type AS ENUM ('daily', 'weekly', 'project');

-- Create timesheet approval type enum
CREATE TYPE public.approval_method AS ENUM ('manager', 'hr', 'auto');

-- Create employee timesheets table
CREATE TABLE public.employee_timesheets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  entry_type timesheet_entry_type NOT NULL DEFAULT 'daily',
  status timesheet_status NOT NULL DEFAULT 'draft',
  total_regular_hours NUMERIC(10,2) DEFAULT 0,
  total_overtime_hours NUMERIC(10,2) DEFAULT 0,
  total_hours NUMERIC(10,2) DEFAULT 0,
  submitted_at TIMESTAMP WITH TIME ZONE,
  approved_at TIMESTAMP WITH TIME ZONE,
  approved_by UUID REFERENCES auth.users(id),
  approval_method approval_method,
  rejection_reason TEXT,
  notes TEXT,
  pay_run_id UUID REFERENCES public.pay_runs(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create timesheet entries table (daily time entries)
CREATE TABLE public.timesheet_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  timesheet_id UUID NOT NULL REFERENCES public.employee_timesheets(id) ON DELETE CASCADE,
  work_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  break_duration NUMERIC(4,2) DEFAULT 0,
  regular_hours NUMERIC(10,2) NOT NULL DEFAULT 0,
  overtime_hours NUMERIC(10,2) DEFAULT 0,
  project_id UUID,
  task_description TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create employee self-service settings table
CREATE TABLE public.employee_self_service (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE UNIQUE,
  user_id UUID REFERENCES auth.users(id),
  can_view_pay_stubs BOOLEAN DEFAULT true,
  can_view_tax_slips BOOLEAN DEFAULT true,
  can_edit_personal_info BOOLEAN DEFAULT true,
  can_submit_timesheets BOOLEAN DEFAULT true,
  last_login_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create timesheet approval rules table
CREATE TABLE public.timesheet_approval_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  approval_method approval_method NOT NULL DEFAULT 'manager',
  auto_approve_after_hours INTEGER DEFAULT 48,
  require_manager_approval BOOLEAN DEFAULT true,
  require_hr_approval BOOLEAN DEFAULT false,
  overtime_requires_approval BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.employee_timesheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timesheet_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_self_service ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timesheet_approval_rules ENABLE ROW LEVEL SECURITY;

-- RLS Policies for employee_timesheets
CREATE POLICY "Org members can view timesheets"
  ON public.employee_timesheets FOR SELECT
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members can create timesheets"
  ON public.employee_timesheets FOR INSERT
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members can update timesheets"
  ON public.employee_timesheets FOR UPDATE
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members can delete draft timesheets"
  ON public.employee_timesheets FOR DELETE
  USING (public.is_org_member(auth.uid(), organization_id) AND status = 'draft');

-- RLS Policies for timesheet_entries
CREATE POLICY "Users can view entries for accessible timesheets"
  ON public.timesheet_entries FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.employee_timesheets ts
    WHERE ts.id = timesheet_id
    AND public.is_org_member(auth.uid(), ts.organization_id)
  ));

CREATE POLICY "Users can create entries for accessible timesheets"
  ON public.timesheet_entries FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.employee_timesheets ts
    WHERE ts.id = timesheet_id
    AND public.is_org_member(auth.uid(), ts.organization_id)
    AND ts.status = 'draft'
  ));

CREATE POLICY "Users can update entries for draft timesheets"
  ON public.timesheet_entries FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.employee_timesheets ts
    WHERE ts.id = timesheet_id
    AND public.is_org_member(auth.uid(), ts.organization_id)
    AND ts.status = 'draft'
  ));

CREATE POLICY "Users can delete entries for draft timesheets"
  ON public.timesheet_entries FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.employee_timesheets ts
    WHERE ts.id = timesheet_id
    AND public.is_org_member(auth.uid(), ts.organization_id)
    AND ts.status = 'draft'
  ));

-- RLS Policies for employee_self_service
CREATE POLICY "Users can view own self-service settings"
  ON public.employee_self_service FOR SELECT
  USING (user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.employees e
    WHERE e.id = employee_id
    AND public.is_org_member(auth.uid(), e.organization_id)
  ));

CREATE POLICY "Org members can manage self-service settings"
  ON public.employee_self_service FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.employees e
    WHERE e.id = employee_id
    AND public.is_org_member(auth.uid(), e.organization_id)
  ));

-- RLS Policies for timesheet_approval_rules
CREATE POLICY "Org members can view approval rules"
  ON public.timesheet_approval_rules FOR SELECT
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members can manage approval rules"
  ON public.timesheet_approval_rules FOR ALL
  USING (public.is_org_member(auth.uid(), organization_id));

-- Create updated_at triggers
CREATE TRIGGER update_employee_timesheets_updated_at
  BEFORE UPDATE ON public.employee_timesheets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_timesheet_entries_updated_at
  BEFORE UPDATE ON public.timesheet_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_employee_self_service_updated_at
  BEFORE UPDATE ON public.employee_self_service
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_timesheet_approval_rules_updated_at
  BEFORE UPDATE ON public.timesheet_approval_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to calculate timesheet totals
CREATE OR REPLACE FUNCTION public.recalculate_timesheet_totals()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.employee_timesheets
  SET 
    total_regular_hours = (
      SELECT COALESCE(SUM(regular_hours), 0) 
      FROM public.timesheet_entries 
      WHERE timesheet_id = COALESCE(NEW.timesheet_id, OLD.timesheet_id)
    ),
    total_overtime_hours = (
      SELECT COALESCE(SUM(overtime_hours), 0) 
      FROM public.timesheet_entries 
      WHERE timesheet_id = COALESCE(NEW.timesheet_id, OLD.timesheet_id)
    ),
    total_hours = (
      SELECT COALESCE(SUM(regular_hours + COALESCE(overtime_hours, 0)), 0) 
      FROM public.timesheet_entries 
      WHERE timesheet_id = COALESCE(NEW.timesheet_id, OLD.timesheet_id)
    )
  WHERE id = COALESCE(NEW.timesheet_id, OLD.timesheet_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER recalculate_timesheet_totals_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.timesheet_entries
  FOR EACH ROW EXECUTE FUNCTION public.recalculate_timesheet_totals();