-- =====================================================
-- Employee Time Clock (punch in/out) with payroll hand-off
-- =====================================================
-- Punches roll into the employee's pay-period timesheet via trigger,
-- so approval + pay run selection keep working exactly as before.

-- -----------------------------------------------------
-- Tables
-- -----------------------------------------------------

CREATE TABLE public.employee_time_clock_punches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  work_date DATE NOT NULL DEFAULT CURRENT_DATE,
  clock_in_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  clock_out_at TIMESTAMP WITH TIME ZONE,
  break_minutes INTEGER NOT NULL DEFAULT 0,
  total_hours NUMERIC(10,2),
  regular_hours NUMERIC(10,2),
  overtime_hours NUMERIC(10,2),
  notes TEXT,
  timesheet_entry_id UUID REFERENCES public.timesheet_entries(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.employee_time_clock_breaks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  punch_id UUID NOT NULL REFERENCES public.employee_time_clock_punches(id) ON DELETE CASCADE,
  break_start_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  break_end_at TIMESTAMP WITH TIME ZONE,
  minutes INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_time_clock_punches_employee ON public.employee_time_clock_punches(employee_id);
CREATE INDEX idx_time_clock_punches_work_date ON public.employee_time_clock_punches(employee_id, work_date);
CREATE INDEX idx_time_clock_punches_entry ON public.employee_time_clock_punches(timesheet_entry_id);
CREATE INDEX idx_time_clock_breaks_punch ON public.employee_time_clock_breaks(punch_id);

-- Guardrail: at most one open punch per employee
CREATE UNIQUE INDEX one_open_punch_per_employee
  ON public.employee_time_clock_punches (employee_id)
  WHERE status = 'open';

-- -----------------------------------------------------
-- Grants
-- -----------------------------------------------------

GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_time_clock_punches TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.employee_time_clock_breaks TO authenticated;
GRANT ALL ON public.employee_time_clock_punches TO service_role;
GRANT ALL ON public.employee_time_clock_breaks TO service_role;

-- -----------------------------------------------------
-- RLS
-- -----------------------------------------------------

ALTER TABLE public.employee_time_clock_punches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_time_clock_breaks ENABLE ROW LEVEL SECURITY;

-- Employee matches by email, same as the self-service page;
-- org admins / payroll roles see everything in their org.
CREATE POLICY "Punches visible to employee and org payroll roles"
  ON public.employee_time_clock_punches FOR SELECT
  TO authenticated
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
        AND om.role IN ('owner', 'admin', 'finance_manager', 'payroll_officer')
    )
  );

CREATE POLICY "Employees can punch in for themselves"
  ON public.employee_time_clock_punches FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.id = employee_id
        AND LOWER(e.email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
        AND e.organization_id = organization_id
    )
  );

CREATE POLICY "Punch stakeholders can update punches"
  ON public.employee_time_clock_punches FOR UPDATE
  TO authenticated
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
        AND om.role IN ('owner', 'admin', 'finance_manager', 'payroll_officer')
    )
  );

CREATE POLICY "Org admins can delete punches"
  ON public.employee_time_clock_punches FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Punch stakeholders can view breaks"
  ON public.employee_time_clock_breaks FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.employee_time_clock_punches p
      WHERE p.id = punch_id
        AND (
          EXISTS (
            SELECT 1 FROM public.employees e
            WHERE e.id = p.employee_id
              AND LOWER(e.email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
          )
          OR EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = p.organization_id
              AND om.user_id = auth.uid()
              AND om.role IN ('owner', 'admin', 'finance_manager', 'payroll_officer')
          )
        )
    )
  );

CREATE POLICY "Employees can start own breaks"
  ON public.employee_time_clock_breaks FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.employee_time_clock_punches p
      JOIN public.employees e ON e.id = p.employee_id
      WHERE p.id = punch_id
        AND LOWER(e.email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
        AND p.status = 'open'
    )
  );

CREATE POLICY "Employees can end own breaks"
  ON public.employee_time_clock_breaks FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.employee_time_clock_punches p
      JOIN public.employees e ON e.id = p.employee_id
      WHERE p.id = punch_id
        AND LOWER(e.email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
        AND p.status = 'open'
    )
  );

-- -----------------------------------------------------
-- updated_at trigger
-- -----------------------------------------------------

CREATE TRIGGER update_time_clock_punches_updated_at
  BEFORE UPDATE ON public.employee_time_clock_punches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- -----------------------------------------------------
-- Locking: no punch edits once its timesheet is approved/processed
-- -----------------------------------------------------

CREATE OR REPLACE FUNCTION public.assert_punch_timesheet_unlocked(p_punch_id UUID)
RETURNS void AS $$
DECLARE
  v_status TEXT;
BEGIN
  IF p_punch_id IS NULL THEN
    RETURN;
  END IF;

  SELECT ts.status INTO v_status
  FROM public.employee_time_clock_punches p
  JOIN public.timesheet_entries te ON te.id = p.timesheet_entry_id
  JOIN public.employee_timesheets ts ON ts.id = te.timesheet_id
  WHERE p.id = p_punch_id;

  IF v_status IS NOT NULL AND v_status IN ('approved', 'processed') THEN
    RAISE EXCEPTION 'This punch is locked because its timesheet has already been %', v_status
      USING ERRCODE = 'raise_exception';
  END IF;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE OR REPLACE FUNCTION public.enforce_punch_lock_on_update()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.assert_punch_timesheet_unlocked(OLD.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE OR REPLACE FUNCTION public.enforce_punch_lock_on_delete()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.assert_punch_timesheet_unlocked(OLD.id);
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER enforce_punch_lock_on_update_trigger
  BEFORE UPDATE ON public.employee_time_clock_punches
  FOR EACH ROW EXECUTE FUNCTION public.enforce_punch_lock_on_update();

CREATE TRIGGER enforce_punch_lock_on_delete_trigger
  BEFORE DELETE ON public.employee_time_clock_punches
  FOR EACH ROW EXECUTE FUNCTION public.enforce_punch_lock_on_delete();

-- -----------------------------------------------------
-- Pay period resolution (mirrors src/lib/timeClock.ts helpers)
-- -----------------------------------------------------

CREATE OR REPLACE FUNCTION public.time_clock_week_start(p_date DATE)
RETURNS DATE AS $$
  SELECT (p_date - ((EXTRACT(DOW FROM p_date)::INT + 6) % 7))::DATE;
$$ LANGUAGE sql IMMUTABLE;

CREATE OR REPLACE FUNCTION public.time_clock_period_bounds(
  p_pay_frequency TEXT,
  p_work_date DATE
) RETURNS TABLE(period_start DATE, period_end DATE, entry_type TEXT) AS $$
DECLARE
  v_monday DATE;
BEGIN
  v_monday := public.time_clock_week_start(p_work_date);

  CASE COALESCE(p_pay_frequency, 'monthly')
    WHEN 'weekly' THEN
      period_start := v_monday;
      period_end := v_monday + 6;
      entry_type := 'weekly';
    WHEN 'bi_weekly' THEN
      -- Anchor fortnights to Monday 2026-01-05 so periods stay stable
      v_monday := v_monday - ((((v_monday - DATE '2026-01-05')::INT % 14) + 14) % 14);
      period_start := v_monday;
      period_end := v_monday + 13;
      entry_type := 'daily';
    WHEN 'semi_monthly' THEN
      IF EXTRACT(DAY FROM p_work_date) <= 15 THEN
        period_start := date_trunc('month', p_work_date)::DATE;
        period_end := period_start + 14;
      ELSE
        period_start := date_trunc('month', p_work_date)::DATE + 15;
        period_end := (date_trunc('month', p_work_date) + INTERVAL '1 month - 1 day')::DATE;
      END IF;
      entry_type := 'daily';
    ELSE
      period_start := date_trunc('month', p_work_date)::DATE;
      period_end := (date_trunc('month', p_work_date) + INTERVAL '1 month - 1 day')::DATE;
      entry_type := 'daily';
  END CASE;

  RETURN NEXT;
END;
$$ LANGUAGE plpgsql STABLE SET search_path = public;

-- -----------------------------------------------------
-- Punch close -> upsert into the pay-period timesheet
-- -----------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_time_clock_punch_close()
RETURNS TRIGGER AS $$
DECLARE
  v_employee RECORD;
  v_timesheet_id UUID;
  v_entry_id UUID;
  v_existing_entry_id UUID;
  v_existing_punch_minutes NUMERIC;
  v_break_minutes NUMERIC;
  v_worked_minutes NUMERIC;
  v_total_hours NUMERIC;
  v_regular_hours NUMERIC;
  v_overtime_hours NUMERIC;
  v_start_time TIME;
  v_end_time TIME;
  v_period RECORD;
BEGIN
  -- Only act when a punch transitions open -> closed
  IF NEW.status <> 'closed' OR NEW.clock_out_at IS NULL THEN
    RETURN NEW;
  END IF;
  IF OLD.status = 'closed' THEN
    RETURN NEW;
  END IF;

  SELECT e.id AS employee_id,
         e.organization_id,
         e.pay_frequency::text AS pay_frequency
    INTO v_employee
  FROM public.employees e
  WHERE e.id = NEW.employee_id;

  -- Break time: recorded break rows win, fall back to the stored counter
  v_break_minutes := COALESCE((
    SELECT SUM(b.minutes)
    FROM public.employee_time_clock_breaks b
    WHERE b.punch_id = NEW.id AND b.break_end_at IS NOT NULL
  ), NEW.break_minutes);
  v_break_minutes := GREATEST(v_break_minutes, 0);

  -- Worked minutes = clock out - clock in - breaks, rounded to 2 decimals
  v_worked_minutes := GREATEST(
    (EXTRACT(EPOCH FROM (NEW.clock_out_at - NEW.clock_in_at)) / 60) - v_break_minutes,
    0
  );
  v_total_hours := ROUND(v_worked_minutes / 60.0, 2);

  -- Daily overtime rule: anything beyond 8h on a single work date
  v_regular_hours := ROUND(LEAST(v_total_hours, 8), 2);
  v_overtime_hours := ROUND(GREATEST(v_total_hours - 8, 0), 2);

  -- Weekly overtime rule: beyond 40 regular hours Mon-Sun, avoiding
  -- double counting with the daily rule. Prior punches in the same week
  -- have already claimed regular hours.
  DECLARE
    v_prior_regular NUMERIC;
  BEGIN
    SELECT COALESCE(SUM(regular_hours), 0) INTO v_prior_regular
    FROM public.employee_time_clock_punches
    WHERE employee_id = NEW.employee_id
      AND status = 'closed'
      AND work_date >= public.time_clock_week_start(NEW.work_date)
      AND work_date < public.time_clock_week_start(NEW.work_date) + 7
      AND id <> NEW.id;

    IF v_prior_regular + v_regular_hours > 40 THEN
      v_overtime_hours := ROUND(v_overtime_hours + (v_prior_regular + v_regular_hours - 40), 2);
      v_regular_hours := ROUND(GREATEST(40 - v_prior_regular, 0), 2);
    END IF;
  END;

  v_start_time := (NEW.clock_in_at AT TIME ZONE 'UTC')::TIME;
  v_end_time := (NEW.clock_out_at AT TIME ZONE 'UTC')::TIME;

  -- Reuse an existing covering timesheet (any type), else create a draft
  -- for the employee's current pay period
  SELECT ts.id INTO v_timesheet_id
  FROM public.employee_timesheets ts
  WHERE ts.employee_id = NEW.employee_id
    AND ts.period_start <= NEW.work_date
    AND ts.period_end >= NEW.work_date
  ORDER BY ts.period_start DESC, ts.created_at DESC
  LIMIT 1;

  IF v_timesheet_id IS NULL THEN
    SELECT * INTO v_period
    FROM public.time_clock_period_bounds(v_employee.pay_frequency, NEW.work_date);

    INSERT INTO public.employee_timesheets (
      employee_id, organization_id, period_start, period_end, entry_type, status
    ) VALUES (
      NEW.employee_id, v_employee.organization_id,
      v_period.period_start, v_period.period_end,
      v_period.entry_type::timesheet_entry_type, 'draft'
    )
    RETURNING id INTO v_timesheet_id;
  END IF;

  -- One timesheet entry per work date; extra punches aggregate into it
  SELECT te.id INTO v_existing_entry_id
  FROM public.timesheet_entries te
  WHERE te.timesheet_id = v_timesheet_id
    AND te.work_date = NEW.work_date
  ORDER BY te.created_at
  LIMIT 1;

  IF v_existing_entry_id IS NOT NULL THEN
    UPDATE public.timesheet_entries te
    SET start_time = LEAST(te.start_time, v_start_time),
        end_time = GREATEST(COALESCE(te.end_time, v_end_time), v_end_time),
        break_duration = ROUND(COALESCE(te.break_duration, 0) + (v_break_minutes / 60.0), 2),
        regular_hours = ROUND(COALESCE(te.regular_hours, 0) + v_regular_hours, 2),
        overtime_hours = ROUND(COALESCE(te.overtime_hours, 0) + v_overtime_hours, 2),
        notes = CASE
          WHEN COALESCE(NEW.notes, '') = '' THEN te.notes
          ELSE trim(COALESCE(te.notes, '') || CASE WHEN COALESCE(te.notes, '') <> '' THEN E'\n' ELSE '' END || NEW.notes)
        END
    WHERE te.id = v_existing_entry_id
    RETURNING te.id INTO v_entry_id;
  ELSE
    INSERT INTO public.timesheet_entries (
      timesheet_id, work_date, start_time, end_time, break_duration,
      regular_hours, overtime_hours, task_description, notes
    ) VALUES (
      v_timesheet_id, NEW.work_date, v_start_time, v_end_time,
      ROUND(v_break_minutes / 60.0, 2),
      v_regular_hours, v_overtime_hours,
      'Time clock shift',
      NULLIF(NEW.notes, '')
    )
    RETURNING id INTO v_entry_id;
  END IF;

  NEW.break_minutes := v_break_minutes::INT;
  NEW.total_hours := v_total_hours;
  NEW.regular_hours := v_regular_hours;
  NEW.overtime_hours := v_overtime_hours;
  NEW.timesheet_entry_id := v_entry_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER handle_time_clock_punch_close_trigger
  BEFORE UPDATE OF status, clock_out_at ON public.employee_time_clock_punches
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_time_clock_punch_close();
