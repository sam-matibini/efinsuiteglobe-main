// Default banking and credit card accounts for Chart of Accounts generation
// These are used when AI generation is not available or as fallback templates

export interface DefaultBankAccount {
  code: string;
  name: string;
  description: string;
  account_type: 'asset';
  account_sub_group: 'Cash' | 'Bank';
  is_header: boolean;
  normal_balance: 'debit';
  is_current: true;
  posting_allowed: boolean;
  parent_code: string | null;
  purpose: 'operating' | 'payroll' | 'savings' | 'foreign_currency' | 'petty_cash' | 'mobile_money' | 'digital_wallet';
}

export interface DefaultCreditCardAccount {
  code: string;
  name: string;
  description: string;
  account_type: 'liability';
  account_sub_group: 'Credit Cards';
  is_header: boolean;
  normal_balance: 'credit';
  is_current: true;
  posting_allowed: boolean;
  parent_code: string | null;
  purpose: 'corporate' | 'employee' | 'fuel' | 'travel';
}

// Bank account templates by country currency
export const DEFAULT_BANK_ACCOUNTS: Record<string, DefaultBankAccount[]> = {
  // Canadian Accounts
  CAD: [
    { code: '1-01-101', name: 'Bank Accounts', description: 'Bank accounts header', account_type: 'asset', account_sub_group: 'Bank', is_header: true, normal_balance: 'debit', is_current: true, posting_allowed: false, parent_code: '1-01', purpose: 'operating' },
    { code: '1-01-101-0001', name: 'Operating Bank - CAD', description: 'Primary operating bank account for day-to-day transactions', account_type: 'asset', account_sub_group: 'Bank', is_header: false, normal_balance: 'debit', is_current: true, posting_allowed: true, parent_code: '1-01-101', purpose: 'operating' },
    { code: '1-01-101-0002', name: 'Payroll Bank - CAD', description: 'Dedicated account for payroll disbursements', account_type: 'asset', account_sub_group: 'Bank', is_header: false, normal_balance: 'debit', is_current: true, posting_allowed: true, parent_code: '1-01-101', purpose: 'payroll' },
    { code: '1-01-101-0003', name: 'Savings/Reserve - CAD', description: 'Savings or reserve account for contingency funds', account_type: 'asset', account_sub_group: 'Bank', is_header: false, normal_balance: 'debit', is_current: true, posting_allowed: true, parent_code: '1-01-101', purpose: 'savings' },
    { code: '1-01-101-0004', name: 'USD Operating Account', description: 'US Dollar account for cross-border transactions', account_type: 'asset', account_sub_group: 'Bank', is_header: false, normal_balance: 'debit', is_current: true, posting_allowed: true, parent_code: '1-01-101', purpose: 'foreign_currency' },
    { code: '1-01-102-0001', name: 'Petty Cash', description: 'Cash on hand for small expenses', account_type: 'asset', account_sub_group: 'Cash', is_header: false, normal_balance: 'debit', is_current: true, posting_allowed: true, parent_code: '1-01-102', purpose: 'petty_cash' },
  ],
  // US Accounts
  USD: [
    { code: '1-01-101', name: 'Bank Accounts', description: 'Bank accounts header', account_type: 'asset', account_sub_group: 'Bank', is_header: true, normal_balance: 'debit', is_current: true, posting_allowed: false, parent_code: '1-01', purpose: 'operating' },
    { code: '1-01-101-0001', name: 'Operating Checking', description: 'Primary operating checking account', account_type: 'asset', account_sub_group: 'Bank', is_header: false, normal_balance: 'debit', is_current: true, posting_allowed: true, parent_code: '1-01-101', purpose: 'operating' },
    { code: '1-01-101-0002', name: 'Payroll Checking', description: 'Dedicated account for payroll disbursements', account_type: 'asset', account_sub_group: 'Bank', is_header: false, normal_balance: 'debit', is_current: true, posting_allowed: true, parent_code: '1-01-101', purpose: 'payroll' },
    { code: '1-01-101-0003', name: 'Money Market Account', description: 'Interest-bearing reserve account', account_type: 'asset', account_sub_group: 'Bank', is_header: false, normal_balance: 'debit', is_current: true, posting_allowed: true, parent_code: '1-01-101', purpose: 'savings' },
    { code: '1-01-102-0001', name: 'Petty Cash', description: 'Cash on hand for small expenses', account_type: 'asset', account_sub_group: 'Cash', is_header: false, normal_balance: 'debit', is_current: true, posting_allowed: true, parent_code: '1-01-102', purpose: 'petty_cash' },
  ],
  // European/UK Accounts
  EUR: [
    { code: '1-01-101', name: 'Bank Accounts', description: 'Bank accounts header', account_type: 'asset', account_sub_group: 'Bank', is_header: true, normal_balance: 'debit', is_current: true, posting_allowed: false, parent_code: '1-01', purpose: 'operating' },
    { code: '1-01-101-0001', name: 'Current Account - EUR', description: 'Primary current account for operations', account_type: 'asset', account_sub_group: 'Bank', is_header: false, normal_balance: 'debit', is_current: true, posting_allowed: true, parent_code: '1-01-101', purpose: 'operating' },
    { code: '1-01-101-0002', name: 'Salary Account - EUR', description: 'Dedicated account for salary payments', account_type: 'asset', account_sub_group: 'Bank', is_header: false, normal_balance: 'debit', is_current: true, posting_allowed: true, parent_code: '1-01-101', purpose: 'payroll' },
    { code: '1-01-101-0003', name: 'Savings Account - EUR', description: 'Business savings account', account_type: 'asset', account_sub_group: 'Bank', is_header: false, normal_balance: 'debit', is_current: true, posting_allowed: true, parent_code: '1-01-101', purpose: 'savings' },
    { code: '1-01-101-0004', name: 'USD Account', description: 'USD account for international transactions', account_type: 'asset', account_sub_group: 'Bank', is_header: false, normal_balance: 'debit', is_current: true, posting_allowed: true, parent_code: '1-01-101', purpose: 'foreign_currency' },
    { code: '1-01-102-0001', name: 'Petty Cash', description: 'Cash on hand for small expenses', account_type: 'asset', account_sub_group: 'Cash', is_header: false, normal_balance: 'debit', is_current: true, posting_allowed: true, parent_code: '1-01-102', purpose: 'petty_cash' },
  ],
  GBP: [
    { code: '1-01-101', name: 'Bank Accounts', description: 'Bank accounts header', account_type: 'asset', account_sub_group: 'Bank', is_header: true, normal_balance: 'debit', is_current: true, posting_allowed: false, parent_code: '1-01', purpose: 'operating' },
    { code: '1-01-101-0001', name: 'Current Account - GBP', description: 'Primary current account for operations', account_type: 'asset', account_sub_group: 'Bank', is_header: false, normal_balance: 'debit', is_current: true, posting_allowed: true, parent_code: '1-01-101', purpose: 'operating' },
    { code: '1-01-101-0002', name: 'Payroll Account - GBP', description: 'Dedicated account for payroll', account_type: 'asset', account_sub_group: 'Bank', is_header: false, normal_balance: 'debit', is_current: true, posting_allowed: true, parent_code: '1-01-101', purpose: 'payroll' },
    { code: '1-01-101-0003', name: 'Business Savings - GBP', description: 'Business savings account', account_type: 'asset', account_sub_group: 'Bank', is_header: false, normal_balance: 'debit', is_current: true, posting_allowed: true, parent_code: '1-01-101', purpose: 'savings' },
    { code: '1-01-101-0004', name: 'EUR Account', description: 'Euro account for EU transactions', account_type: 'asset', account_sub_group: 'Bank', is_header: false, normal_balance: 'debit', is_current: true, posting_allowed: true, parent_code: '1-01-101', purpose: 'foreign_currency' },
    { code: '1-01-102-0001', name: 'Petty Cash', description: 'Cash on hand for small expenses', account_type: 'asset', account_sub_group: 'Cash', is_header: false, normal_balance: 'debit', is_current: true, posting_allowed: true, parent_code: '1-01-102', purpose: 'petty_cash' },
  ],
  // Default for other currencies
  DEFAULT: [
    { code: '1-01-101', name: 'Bank Accounts', description: 'Bank accounts header', account_type: 'asset', account_sub_group: 'Bank', is_header: true, normal_balance: 'debit', is_current: true, posting_allowed: false, parent_code: '1-01', purpose: 'operating' },
    { code: '1-01-101-0001', name: 'Operating Bank Account', description: 'Primary operating bank account', account_type: 'asset', account_sub_group: 'Bank', is_header: false, normal_balance: 'debit', is_current: true, posting_allowed: true, parent_code: '1-01-101', purpose: 'operating' },
    { code: '1-01-101-0002', name: 'Payroll Bank Account', description: 'Dedicated account for payroll disbursements', account_type: 'asset', account_sub_group: 'Bank', is_header: false, normal_balance: 'debit', is_current: true, posting_allowed: true, parent_code: '1-01-101', purpose: 'payroll' },
    { code: '1-01-101-0003', name: 'Savings Account', description: 'Business savings account', account_type: 'asset', account_sub_group: 'Bank', is_header: false, normal_balance: 'debit', is_current: true, posting_allowed: true, parent_code: '1-01-101', purpose: 'savings' },
    { code: '1-01-102-0001', name: 'Petty Cash', description: 'Cash on hand for small expenses', account_type: 'asset', account_sub_group: 'Cash', is_header: false, normal_balance: 'debit', is_current: true, posting_allowed: true, parent_code: '1-01-102', purpose: 'petty_cash' },
  ],
};

// Credit Card account templates
export const DEFAULT_CREDIT_CARD_ACCOUNTS: Record<string, DefaultCreditCardAccount[]> = {
  // Universal templates (same structure for all currencies)
  DEFAULT: [
    { code: '2-01-110', name: 'Credit Card Liabilities', description: 'Credit card liabilities header', account_type: 'liability', account_sub_group: 'Credit Cards', is_header: true, normal_balance: 'credit', is_current: true, posting_allowed: false, parent_code: '2-01', purpose: 'corporate' },
    { code: '2-01-110-0001', name: 'Corporate Credit Card', description: 'Primary business credit card for operations', account_type: 'liability', account_sub_group: 'Credit Cards', is_header: false, normal_balance: 'credit', is_current: true, posting_allowed: true, parent_code: '2-01-110', purpose: 'corporate' },
    { code: '2-01-110-0002', name: 'Employee Expense Card', description: 'Credit card for employee reimbursable expenses', account_type: 'liability', account_sub_group: 'Credit Cards', is_header: false, normal_balance: 'credit', is_current: true, posting_allowed: true, parent_code: '2-01-110', purpose: 'employee' },
    { code: '2-01-110-0003', name: 'Travel & Entertainment Card', description: 'Credit card for travel and entertainment expenses', account_type: 'liability', account_sub_group: 'Credit Cards', is_header: false, normal_balance: 'credit', is_current: true, posting_allowed: true, parent_code: '2-01-110', purpose: 'travel' },
  ],
  // Industry-specific additions
  FLEET: [
    { code: '2-01-110', name: 'Credit Card Liabilities', description: 'Credit card liabilities header', account_type: 'liability', account_sub_group: 'Credit Cards', is_header: true, normal_balance: 'credit', is_current: true, posting_allowed: false, parent_code: '2-01', purpose: 'corporate' },
    { code: '2-01-110-0001', name: 'Corporate Credit Card', description: 'Primary business credit card', account_type: 'liability', account_sub_group: 'Credit Cards', is_header: false, normal_balance: 'credit', is_current: true, posting_allowed: true, parent_code: '2-01-110', purpose: 'corporate' },
    { code: '2-01-110-0002', name: 'Fleet Fuel Card', description: 'Fuel card for company vehicles', account_type: 'liability', account_sub_group: 'Credit Cards', is_header: false, normal_balance: 'credit', is_current: true, posting_allowed: true, parent_code: '2-01-110', purpose: 'fuel' },
    { code: '2-01-110-0003', name: 'Vehicle Maintenance Card', description: 'Card for vehicle repair and maintenance', account_type: 'liability', account_sub_group: 'Credit Cards', is_header: false, normal_balance: 'credit', is_current: true, posting_allowed: true, parent_code: '2-01-110', purpose: 'fuel' },
    { code: '2-01-110-0004', name: 'Employee Expense Card', description: 'Credit card for employee expenses', account_type: 'liability', account_sub_group: 'Credit Cards', is_header: false, normal_balance: 'credit', is_current: true, posting_allowed: true, parent_code: '2-01-110', purpose: 'employee' },
  ],
};

// Industries that typically need fleet/fuel cards
export const FLEET_INDUSTRIES = [
  'automotive',
  'automotive_repairs',
  'car_dealers',
  'construction',
  'transportation',
  'logistics',
  'trucking',
  'delivery',
  'field_services',
  'utilities',
];

/**
 * Mobile money & digital wallet GL accounts — appended to every currency template
 * so fintech wallets (M-Pesa, Lumicash, PayPal, Wise, etc.) can be linked to a GL.
 */
export const DEFAULT_MOBILE_WALLET_ACCOUNTS: DefaultBankAccount[] = [
  { code: '1-01-103', name: 'Mobile Money & Digital Wallets', description: 'Mobile money and fintech wallet header', account_type: 'asset', account_sub_group: 'Bank', is_header: true, normal_balance: 'debit', is_current: true, posting_allowed: false, parent_code: '1-01', purpose: 'mobile_money' },
  { code: '1-01-103-0001', name: 'Mobile Money Wallet', description: 'Mobile money wallet (M-Pesa, MTN MoMo, Airtel Money, Lumicash, etc.)', account_type: 'asset', account_sub_group: 'Bank', is_header: false, normal_balance: 'debit', is_current: true, posting_allowed: true, parent_code: '1-01-103', purpose: 'mobile_money' },
  { code: '1-01-103-0002', name: 'Digital Wallet', description: 'Digital wallet balance (PayPal, Wise, Stripe Balance, etc.)', account_type: 'asset', account_sub_group: 'Bank', is_header: false, normal_balance: 'debit', is_current: true, posting_allowed: true, parent_code: '1-01-103', purpose: 'digital_wallet' },
];

/**
 * Get default bank accounts for a currency (includes mobile money & wallet block)
 */
export function getDefaultBankAccounts(currency: string): DefaultBankAccount[] {
  const base = DEFAULT_BANK_ACCOUNTS[currency] || DEFAULT_BANK_ACCOUNTS.DEFAULT;
  return [...base, ...DEFAULT_MOBILE_WALLET_ACCOUNTS];
}

/**
 * Get default credit card accounts for an industry
 */
export function getDefaultCreditCardAccounts(industry?: string): DefaultCreditCardAccount[] {
  if (industry && FLEET_INDUSTRIES.includes(industry.toLowerCase())) {
    return DEFAULT_CREDIT_CARD_ACCOUNTS.FLEET;
  }
  return DEFAULT_CREDIT_CARD_ACCOUNTS.DEFAULT;
}

/**
 * Get all default banking GL accounts (bank + credit card) for CoA generation
 */
export function getAllDefaultBankingAccounts(currency: string, industry?: string) {
  const bankAccounts = getDefaultBankAccounts(currency);
  const creditCardAccounts = getDefaultCreditCardAccounts(industry);
  
  return {
    bankAccounts,
    creditCardAccounts,
    combined: [
      ...bankAccounts.map(acc => ({
        ...acc,
        account_class: 'Asset',
        account_group: 'Current Asset',
      })),
      ...creditCardAccounts.map(acc => ({
        ...acc,
        account_class: 'Liability',
        account_group: 'Current Liability',
      })),
    ],
  };
}
