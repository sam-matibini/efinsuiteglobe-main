
-- ============================================================================
-- CASH FLOW STATEMENT SCHEMA IMPROVEMENTS
-- ============================================================================
-- 1. Fix accumulated depreciation accounts with incorrect normal_balance
-- 2. Add cash_flow_category column for explicit cash flow classification
-- 3. Add trigger to auto-correct contra-asset normal_balance on insert/update
-- ============================================================================

-- 1. Fix all accumulated depreciation/amortization accounts that have incorrect normal_balance
-- Accumulated depreciation is a CONTRA-ASSET and should ALWAYS have credit normal_balance
UPDATE accounts
SET normal_balance = 'credit',
    updated_at = now()
WHERE is_header = false
  AND account_type = 'asset'
  AND normal_balance = 'debit'
  AND (
    LOWER(name) LIKE '%accumulated%depreciation%' OR
    LOWER(name) LIKE '%accumulated%amortization%' OR
    LOWER(name) LIKE '%accum%depreciation%' OR
    LOWER(name) LIKE '%accum%amortization%' OR
    (code LIKE '%-9000' AND LOWER(name) LIKE '%depreciation%') OR
    (code LIKE '%-9000' AND LOWER(name) LIKE '%amortization%')
  );

-- 2. Add cash_flow_category column if not exists
-- This allows explicit override of automatic cash flow classification
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'accounts' 
      AND column_name = 'cash_flow_category'
  ) THEN
    ALTER TABLE accounts 
    ADD COLUMN cash_flow_category VARCHAR(50) DEFAULT NULL;
    
    COMMENT ON COLUMN accounts.cash_flow_category IS 
      'Explicit cash flow statement classification: operating, investing, financing, or NULL for automatic detection';
  END IF;
END $$;

-- 3. Create function to auto-correct normal_balance for contra accounts
CREATE OR REPLACE FUNCTION enforce_contra_account_normal_balance()
RETURNS TRIGGER AS $$
BEGIN
  -- Accumulated depreciation/amortization are CONTRA-ASSETS (credit normal balance)
  IF NEW.account_type = 'asset' AND (
    LOWER(NEW.name) LIKE '%accumulated%depreciation%' OR
    LOWER(NEW.name) LIKE '%accumulated%amortization%' OR
    LOWER(NEW.name) LIKE '%accum%depreciation%' OR
    LOWER(NEW.name) LIKE '%accum%amortization%'
  ) THEN
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

-- Drop existing trigger if exists and recreate
DROP TRIGGER IF EXISTS trigger_enforce_contra_account_normal_balance ON accounts;

CREATE TRIGGER trigger_enforce_contra_account_normal_balance
BEFORE INSERT OR UPDATE ON accounts
FOR EACH ROW
EXECUTE FUNCTION enforce_contra_account_normal_balance();

-- Add index for cash_flow_category queries
CREATE INDEX IF NOT EXISTS idx_accounts_cash_flow_category 
ON accounts(cash_flow_category) 
WHERE cash_flow_category IS NOT NULL;
