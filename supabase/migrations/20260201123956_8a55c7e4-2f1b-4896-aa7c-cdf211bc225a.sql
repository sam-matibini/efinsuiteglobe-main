-- Update bank_transactions status constraint to include 'pending' status
-- This is commonly needed for newly imported transactions awaiting categorization

-- Drop the existing constraint
ALTER TABLE public.bank_transactions DROP CONSTRAINT IF EXISTS bank_transactions_status_check;

-- Add updated constraint with 'pending' included
ALTER TABLE public.bank_transactions 
ADD CONSTRAINT bank_transactions_status_check 
CHECK (status IN ('pending', 'unmatched', 'matched', 'reconciled'));

-- Add comment for documentation
COMMENT ON COLUMN public.bank_transactions.status IS 
'Transaction status: pending (newly imported), unmatched (no category), matched (categorized), reconciled (bank statement cleared)';