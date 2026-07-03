
-- Fix equity account classifications for 85911 INC.
-- This is required for Statement of Changes in Equity to properly display Share Capital

-- Set Common Shares as COMMON_STOCK category
UPDATE accounts 
SET equity_category = 'COMMON_STOCK',
    equity_type = 'share_capital'
WHERE id = 'eefb4859-5c1f-4d03-b8ff-10c130bfc42e'
  AND code = '3-01-101-0001';

-- Set Retained Earnings category
UPDATE accounts 
SET equity_category = 'RETAINED_EARNINGS',
    equity_type = 'retained_earnings'
WHERE id = 'b6364a58-a23e-40a8-b908-87710eff2dfb'
  AND code = '3-01-101-0002';

-- Set Dividends Declared with proper equity_type
UPDATE accounts 
SET equity_category = 'DIVIDENDS',
    equity_type = 'dividends'
WHERE id = '22b4c295-ba79-4d8e-b0d0-32bb20e8ed68'
  AND code = '3-01-101-0003';
