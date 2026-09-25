
-- 1. Backfill: Fix contra-asset accounts with abbreviated names to credit normal_balance
UPDATE public.accounts
SET normal_balance = 'credit'
WHERE account_type = 'asset'
  AND normal_balance = 'debit'
  AND LOWER(name) ~ '(accum+\.?\s*(dep|deprec|amort))';

-- 2. Set is_current=false for contra fixed-asset accounts (accumulated dep/amort)
UPDATE public.accounts
SET is_current = false
WHERE account_type = 'asset'
  AND LOWER(name) ~ '(accum+\.?\s*(dep|deprec|amort))'
  AND (is_current IS NULL OR is_current = true);

-- 3. Replace the trigger function with broader regex matching
CREATE OR REPLACE FUNCTION enforce_contra_account_normal_balance()
RETURNS TRIGGER AS $$
BEGIN
  -- Accumulated depreciation/amortization are CONTRA-ASSETS (credit normal balance)
  -- Matches: accumulated depreciation, accum. dep, accumm. dep, accum depreciation, etc.
  IF NEW.account_type = 'asset' AND
     LOWER(NEW.name) ~ '(accum+\.?\s*(dep|deprec|depreciation|amort|amortization))' THEN
    NEW.normal_balance := 'credit';
  END IF;
  
  -- Allowance for doubtful accounts is a CONTRA-ASSET (credit normal balance)
  IF NEW.account_type = 'asset' AND (
    LOWER(NEW.name) LIKE '%allowance%' OR
    LOWER(NEW.name) LIKE '%provision for%bad%' OR
    LOWER(NEW.name) LIKE '%provision for%doubtful%'
  ) THEN
    NEW.normal_balance := 'credit';
  END IF;
  
  -- Sales returns/discounts are CONTRA-REVENUE (debit normal balance)
  IF NEW.account_type = 'income' AND (
    LOWER(NEW.name) LIKE '%returns%' OR
    LOWER(NEW.name) LIKE '%discount%' OR
    LOWER(NEW.name) LIKE '%allowances%'
  ) THEN
    NEW.normal_balance := 'debit';
  END IF;
  
  -- Owner's drawings/distributions are CONTRA-EQUITY (debit normal balance)
  IF NEW.account_type = 'equity' AND (
    LOWER(NEW.name) LIKE '%drawing%' OR
    LOWER(NEW.name) LIKE '%distribution%' OR
    LOWER(NEW.name) LIKE '%dividend%' OR
    LOWER(NEW.name) LIKE '%treasury%'
  ) THEN
    NEW.normal_balance := 'debit';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;
