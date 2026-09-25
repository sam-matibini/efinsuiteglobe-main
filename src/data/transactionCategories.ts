// Dynamic transaction category groups based on accounting framework
// ASNPO = NPO/Charity/Religious organizations
// ASPE/IFRS = For-profit organizations

export interface CategoryGroup {
  label: string;
  categories: string[];
}

// ── For-Profit (ASPE / IFRS) ──────────────────────────────────────

const ASPE_BANK_CATEGORIES: CategoryGroup[] = [
  {
    label: 'Revenue',
    categories: [
      'Sales Revenue',
      'Service Revenue',
      'Interest Income',
      'Dividend Income',
      'Other Income',
    ],
  },
  {
    label: 'Cost of Goods Sold',
    categories: [
      'Cost of Goods Sold',
      'Direct Materials',
      'Direct Labour',
      'Manufacturing Overhead',
    ],
  },
  {
    label: 'Operating Expenses',
    categories: [
      'Advertising & Marketing',
      'Bank Fees & Charges',
      'Depreciation & Amortization',
      'Dues & Subscriptions',
      'Insurance Expense',
      'Internet & Telecommunications',
      'Legal & Professional Fees',
      'Meals & Entertainment',
      'Office Supplies',
      'Payroll Expense',
      'Postage & Shipping',
      'Rent Expense',
      'Repairs & Maintenance',
      'Software & Technology',
      'Travel Expense',
      'Utilities',
      'Vehicle & Fuel',
    ],
  },
  {
    label: 'Other Expenses',
    categories: [
      'Interest Expense',
      'Bad Debt Expense',
      'Foreign Exchange Loss',
      'Other Expense',
    ],
  },
  {
    label: 'Transfers & Payments',
    categories: [
      'Transfer',
      'Customer Payment Received',
      'Vendor Payment Made',
      'Loan Payment',
      'Owner Draw',
      'Owner Contribution',
    ],
  },
];

const ASPE_CC_CATEGORIES: CategoryGroup[] = [
  {
    label: 'Operating Expenses',
    categories: [
      'Advertising & Marketing',
      'Bank Fees & Charges',
      'Dues & Subscriptions',
      'Insurance Expense',
      'Internet & Telecommunications',
      'Legal & Professional Fees',
      'Meals & Entertainment',
      'Office Supplies',
      'Postage & Shipping',
      'Rent Expense',
      'Repairs & Maintenance',
      'Software & Technology',
      'Travel Expense',
      'Utilities',
      'Vehicle & Fuel',
    ],
  },
  {
    label: 'Cost of Goods Sold',
    categories: [
      'Cost of Goods Sold',
      'Direct Materials',
      'Direct Labour',
      'Inventory Purchases',
    ],
  },
  {
    label: 'Other Expenses',
    categories: [
      'Interest Expense',
      'Foreign Exchange Loss',
      'Other Expense',
    ],
  },
  {
    label: 'Credit Card Actions',
    categories: [
      'Payment',
      'Credit/Refund',
      'Reward Redemption',
    ],
  },
];

// ── NPO / Charity / Religious (ASNPO) ────────────────────────────

const ASNPO_BANK_CATEGORIES: CategoryGroup[] = [
  {
    label: 'Revenue & Contributions',
    categories: [
      'Donations - Unrestricted',
      'Donations - Restricted',
      'Tithes & Offerings',
      'Grant Revenue',
      'Fundraising Revenue',
      'Membership Fees',
      'Program Revenue',
      'Interest & Investment Income',
      'Rental Income',
      'Other Revenue',
    ],
  },
  {
    label: 'Program Expenses',
    categories: [
      'Charitable Programs',
      'Mission & Outreach',
      'Community Services',
      'Education & Training Programs',
      'Youth Programs',
      'Worship & Ministry',
      'Program Supplies',
      'Program Salaries & Wages',
    ],
  },
  {
    label: 'Administrative Expenses',
    categories: [
      'Management & Administration',
      'Office Supplies & Expenses',
      'Rent & Occupancy',
      'Insurance Expense',
      'Legal & Professional Fees',
      'Accounting & Audit Fees',
      'Bank Fees & Charges',
      'Internet & Telecommunications',
      'Software & Technology',
      'Payroll - Administrative',
      'Depreciation & Amortization',
      'Repairs & Maintenance',
      'Utilities',
    ],
  },
  {
    label: 'Fundraising Expenses',
    categories: [
      'Fundraising Costs',
      'Event Expenses',
      'Donor Recognition',
      'Marketing & Communications',
      'Printing & Publications',
    ],
  },
  {
    label: 'Other Expenses',
    categories: [
      'Interest Expense',
      'Foreign Exchange Loss',
      'Other Expense',
    ],
  },
  {
    label: 'Transfers & Payments',
    categories: [
      'Transfer',
      'Vendor Payment Made',
      'Loan Payment',
      'Restricted Fund Transfer',
    ],
  },
];

const ASNPO_CC_CATEGORIES: CategoryGroup[] = [
  {
    label: 'Program Expenses',
    categories: [
      'Charitable Programs',
      'Mission & Outreach',
      'Community Services',
      'Program Supplies',
      'Education & Training Programs',
    ],
  },
  {
    label: 'Administrative Expenses',
    categories: [
      'Office Supplies & Expenses',
      'Insurance Expense',
      'Internet & Telecommunications',
      'Software & Technology',
      'Legal & Professional Fees',
      'Rent & Occupancy',
      'Repairs & Maintenance',
      'Utilities',
    ],
  },
  {
    label: 'Fundraising Expenses',
    categories: [
      'Fundraising Costs',
      'Event Expenses',
      'Marketing & Communications',
      'Printing & Publications',
    ],
  },
  {
    label: 'Other Expenses',
    categories: [
      'Interest Expense',
      'Foreign Exchange Loss',
      'Other Expense',
    ],
  },
  {
    label: 'Credit Card Actions',
    categories: [
      'Payment',
      'Credit/Refund',
      'Reward Redemption',
    ],
  },
];

// ── Public API ────────────────────────────────────────────────────

export type TransactionContext = 'bank' | 'credit_card';

/**
 * Returns the appropriate category groups based on accounting framework.
 * Pass the organization's accounting framework ('ASNPO', 'ASPE', 'IFRS')
 * and the transaction context ('bank' or 'credit_card').
 */
export function getCategoryGroups(
  accountingFramework: string | undefined | null,
  context: TransactionContext = 'bank'
): CategoryGroup[] {
  const isNpo = accountingFramework === 'ASNPO';

  if (context === 'credit_card') {
    return isNpo ? ASNPO_CC_CATEGORIES : ASPE_CC_CATEGORIES;
  }
  return isNpo ? ASNPO_BANK_CATEGORIES : ASPE_BANK_CATEGORIES;
}

/**
 * Returns a flat list of all category names for a given framework and context.
 */
export function getCategoryOptions(
  accountingFramework: string | undefined | null,
  context: TransactionContext = 'bank'
): string[] {
  return getCategoryGroups(accountingFramework, context).flatMap(g => g.categories);
}
