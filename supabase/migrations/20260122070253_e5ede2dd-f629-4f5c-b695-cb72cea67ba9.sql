
-- Create GST/HST Receivable asset account for OSEA organization
INSERT INTO accounts (
  organization_id,
  code,
  name,
  account_type,
  normal_balance,
  is_header,
  is_active,
  parent_id,
  description,
  current_balance,
  opening_balance
) VALUES (
  'cdd3ef9d-7b51-44c1-9b37-ded5ab97184f',
  '1-01-103-0020',
  'GST/HST Receivable',
  'asset',
  'debit',
  false,
  true,
  '771e5be9-8c19-49e0-9041-dfe54dd5ee99', -- Prepaid & Other Current Assets parent
  'Input tax credits and GST/HST refunds receivable',
  0,
  0
);

-- Create Income Tax Expense account for OSEA organization
INSERT INTO accounts (
  organization_id,
  code,
  name,
  account_type,
  normal_balance,
  is_header,
  is_active,
  parent_id,
  description,
  current_balance,
  opening_balance
) VALUES (
  'cdd3ef9d-7b51-44c1-9b37-ded5ab97184f',
  '5-01-105-0001',
  'Income Tax Expense',
  'expense',
  'debit',
  false,
  true,
  NULL,
  'Corporate income tax expense',
  0,
  0
);
