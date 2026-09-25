ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS termination_reason_code public.roe_reason,
  ADD COLUMN IF NOT EXISTS termination_reason_notes text;