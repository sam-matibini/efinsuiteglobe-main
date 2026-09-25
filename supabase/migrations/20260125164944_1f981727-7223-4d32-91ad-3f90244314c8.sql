-- Add billed tracking columns to time entries if not exist
ALTER TABLE public.pm_time_entries ADD COLUMN IF NOT EXISTS is_billed BOOLEAN DEFAULT false;
ALTER TABLE public.pm_time_entries ADD COLUMN IF NOT EXISTS billed_invoice_id UUID REFERENCES public.pm_invoices(id) ON DELETE SET NULL;