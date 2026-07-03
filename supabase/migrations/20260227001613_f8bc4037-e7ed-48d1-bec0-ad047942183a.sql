
-- A1: Set cash_flow_category = 'investing' for all non-current asset COST accounts
-- (code starts with '1-02', normal_balance = debit, not a header) that currently have NULL
UPDATE public.accounts
SET cash_flow_category = 'investing'
WHERE code LIKE '1-02%'
  AND normal_balance = 'debit'
  AND is_header = false
  AND account_type = 'asset'
  AND cash_flow_category IS NULL;

-- A2: Clear cash_flow_category for accumulated depreciation/amortization accounts
-- that incorrectly have cash_flow_category = 'investing'
UPDATE public.accounts
SET cash_flow_category = NULL
WHERE cash_flow_category = 'investing'
  AND (
    name ~* '\b(accumulated|accum|accumm?)\.?\s*(depreciation|deprec|dep|amortization|amort)\b'
    OR normal_balance = 'credit'
  )
  AND account_type = 'asset'
  AND code LIKE '1-02%';

-- A3: Update the trigger to also clear cash_flow_category for contra-asset accounts
CREATE OR REPLACE FUNCTION public.enforce_contra_account_normal_balance()
RETURNS TRIGGER AS $$
BEGIN
  -- Contra-Asset accounts: Accumulated Depreciation, Allowance for Doubtful Accounts
  IF NEW.account_type = 'asset' AND (
    NEW.name ~* '\b(accumulated|accum|accumm?)\.?\s*(depreciation|deprec(?:iation)?|dep|amortization|amort)\b' OR
    NEW.name ~* '\ballowance\s+for\s+(doubtful|bad|uncollect)\b'
  ) THEN
    NEW.normal_balance := 'credit';
    NEW.cash_flow_category := NULL;  -- contra-assets belong in Operating, not Investing
  END IF;

  -- Contra-Revenue accounts: Sales Returns, Discounts, Allowances
  IF NEW.account_type = 'income' AND (
    NEW.name ~* '\b(sales\s+returns|sales\s+discount|revenue\s+discount|allowance)\b'
  ) THEN
    NEW.normal_balance := 'debit';
  END IF;

  -- Contra-Equity accounts: Drawings, Distributions, Dividends, Treasury Stock
  IF NEW.account_type = 'equity' AND (
    NEW.name ~* '\b(drawing|distribution|dividend|treasury\s+stock)\b'
  ) THEN
    NEW.normal_balance := 'debit';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
