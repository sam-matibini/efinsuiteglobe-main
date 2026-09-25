-- Add journal_entry_id column to pay_runs to link payroll to GL
ALTER TABLE public.pay_runs
ADD COLUMN IF NOT EXISTS journal_entry_id uuid REFERENCES public.journal_entries(id);