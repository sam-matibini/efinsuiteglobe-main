ALTER TABLE public.organizations ALTER COLUMN invoice_wise_enabled SET DEFAULT true;
UPDATE public.organizations SET invoice_wise_enabled = true WHERE invoice_wise_enabled = false;