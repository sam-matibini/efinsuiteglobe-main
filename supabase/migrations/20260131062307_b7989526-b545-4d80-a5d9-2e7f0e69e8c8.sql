-- Drop the existing status check constraint and create a new one with all required statuses
ALTER TABLE public.invoices 
DROP CONSTRAINT IF EXISTS invoices_status_check;

ALTER TABLE public.invoices 
ADD CONSTRAINT invoices_status_check 
CHECK (status IN ('draft', 'issued', 'final', 'sent', 'paid', 'overdue', 'void', 'partial'));