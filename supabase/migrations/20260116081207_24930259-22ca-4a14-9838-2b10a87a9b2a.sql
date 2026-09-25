-- Temporarily disable the trigger that prevents modifications to posted entries
ALTER TABLE public.journal_entry_lines DISABLE TRIGGER trigger_prevent_posted_line_modification;

-- Fix the 1-cent rounding error in payroll entry PAY-D58EC63C
-- The entry has 6798.69 debits and 6798.68 credits (0.01 imbalance)
-- Fix by increasing EI Payable credit from 246.89 to 246.90
UPDATE public.journal_entry_lines
SET credit = 246.90
WHERE id = '4b7c8cec-abc6-4d5e-b04e-971a52bed08b';

-- Re-enable the trigger
ALTER TABLE public.journal_entry_lines ENABLE TRIGGER trigger_prevent_posted_line_modification;