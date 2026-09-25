-- Fix GST/HST Input Tax Credits (ITC) account type
-- ITC is an ASSET (debit-normal) that represents tax paid on purchases that can be claimed back

-- Update the incorrectly typed ITC account for organization 644c96b7-00a9-4e32-af86-09975e9f52f6
UPDATE accounts 
SET 
  account_type = 'asset',
  account_class = 'Asset',
  account_group = 'Current Asset',
  account_sub_group = 'Tax Receivable',
  is_current = true
WHERE id = '8ea2c6f7-4454-4d09-b0cf-a9a1a0f0ae05';

-- Also update any other ITC accounts that might have the wrong type
UPDATE accounts 
SET 
  account_type = 'asset',
  account_class = 'Asset',
  account_group = 'Current Asset', 
  account_sub_group = 'Tax Receivable',
  is_current = true
WHERE (name ILIKE '%Input Tax Credit%' OR name ILIKE '%ITC%' OR name ILIKE '%Tax Receivable%')
  AND account_type = 'liability'
  AND name NOT ILIKE '%Payable%';