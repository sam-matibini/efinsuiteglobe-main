import { 
  Organization, 
  Account, 
  TrialBalanceRow, 
  Customer, 
  Vendor, 
  Invoice, 
  BankAccount,
  TaxCode,
  Employee,
  JournalEntry
} from '@/types/accounting';

export const organizations: Organization[] = [
  {
    id: 'org-1',
    name: 'Acme Corporation',
    industry: 'professional_services',
    baseCurrency: 'CAD',
    fiscalYearEnd: '12-31',
    taxRegistrations: [
      { type: 'GST', number: '123456789RT0001', jurisdiction: 'Federal' },
      { type: 'QST', number: '1234567890TQ0001', jurisdiction: 'Quebec' }
    ],
    createdAt: new Date('2023-01-15'),
    isActive: true
  },
  {
    id: 'org-2',
    name: 'TechStart Inc.',
    industry: 'fintech',
    baseCurrency: 'CAD',
    fiscalYearEnd: '03-31',
    taxRegistrations: [
      { type: 'HST', number: '987654321RT0001', jurisdiction: 'Ontario' }
    ],
    createdAt: new Date('2024-06-01'),
    isActive: true
  },
  {
    id: 'org-3',
    name: 'Green Earth NPO',
    industry: 'npo',
    baseCurrency: 'CAD',
    fiscalYearEnd: '12-31',
    taxRegistrations: [],
    createdAt: new Date('2022-03-20'),
    isActive: true
  }
];

export const chartOfAccounts: Account[] = [
  // Assets (1000-1999)
  {
    id: 'acc-1000',
    code: '1000',
    name: 'Assets',
    type: 'asset',
    normalBalance: 'debit',
    parentId: null,
    isPostable: false,
    isActive: true,
    balance: 485000,
    children: [
      {
        id: 'acc-1100',
        code: '1100',
        name: 'Current Assets',
        type: 'asset',
        normalBalance: 'debit',
        parentId: 'acc-1000',
        isPostable: false,
        isActive: true,
        balance: 285000,
        children: [
          { id: 'acc-1110', code: '1110', name: 'Cash on Hand', type: 'asset', normalBalance: 'debit', parentId: 'acc-1100', isPostable: true, isActive: true, balance: 5000 },
          { id: 'acc-1120', code: '1120', name: 'Bank - Operating', type: 'asset', normalBalance: 'debit', parentId: 'acc-1100', isPostable: true, isActive: true, balance: 125000 },
          { id: 'acc-1130', code: '1130', name: 'Bank - Savings', type: 'asset', normalBalance: 'debit', parentId: 'acc-1100', isPostable: true, isActive: true, balance: 75000 },
          { id: 'acc-1200', code: '1200', name: 'Accounts Receivable', type: 'asset', normalBalance: 'debit', parentId: 'acc-1100', isPostable: true, isActive: true, balance: 65000 },
          { id: 'acc-1300', code: '1300', name: 'Prepaid Expenses', type: 'asset', normalBalance: 'debit', parentId: 'acc-1100', isPostable: true, isActive: true, balance: 15000 }
        ]
      },
      {
        id: 'acc-1500',
        code: '1500',
        name: 'Fixed Assets',
        type: 'asset',
        normalBalance: 'debit',
        parentId: 'acc-1000',
        isPostable: false,
        isActive: true,
        balance: 200000,
        children: [
          { id: 'acc-1510', code: '1510', name: 'Equipment', type: 'asset', normalBalance: 'debit', parentId: 'acc-1500', isPostable: true, isActive: true, balance: 150000 },
          { id: 'acc-1520', code: '1520', name: 'Accumulated Depreciation - Equipment', type: 'asset', normalBalance: 'credit', parentId: 'acc-1500', isPostable: true, isActive: true, balance: -30000 },
          { id: 'acc-1530', code: '1530', name: 'Furniture & Fixtures', type: 'asset', normalBalance: 'debit', parentId: 'acc-1500', isPostable: true, isActive: true, balance: 50000 },
          { id: 'acc-1540', code: '1540', name: 'Accumulated Depreciation - Furniture', type: 'asset', normalBalance: 'credit', parentId: 'acc-1500', isPostable: true, isActive: true, balance: -10000 }
        ]
      }
    ]
  },
  // Liabilities (2000-2999)
  {
    id: 'acc-2000',
    code: '2000',
    name: 'Liabilities',
    type: 'liability',
    normalBalance: 'credit',
    parentId: null,
    isPostable: false,
    isActive: true,
    balance: 145000,
    children: [
      {
        id: 'acc-2100',
        code: '2100',
        name: 'Current Liabilities',
        type: 'liability',
        normalBalance: 'credit',
        parentId: 'acc-2000',
        isPostable: false,
        isActive: true,
        balance: 95000,
        children: [
          { id: 'acc-2110', code: '2110', name: 'Accounts Payable', type: 'liability', normalBalance: 'credit', parentId: 'acc-2100', isPostable: true, isActive: true, balance: 45000 },
          { id: 'acc-2120', code: '2120', name: 'Accrued Expenses', type: 'liability', normalBalance: 'credit', parentId: 'acc-2100', isPostable: true, isActive: true, balance: 12000 },
          { id: 'acc-2130', code: '2130', name: 'GST/HST Payable', type: 'liability', normalBalance: 'credit', parentId: 'acc-2100', isPostable: true, isActive: true, balance: 8500 },
          { id: 'acc-2140', code: '2140', name: 'Payroll Liabilities', type: 'liability', normalBalance: 'credit', parentId: 'acc-2100', isPostable: true, isActive: true, balance: 15500 },
          { id: 'acc-2150', code: '2150', name: 'Unearned Revenue', type: 'liability', normalBalance: 'credit', parentId: 'acc-2100', isPostable: true, isActive: true, balance: 14000 }
        ]
      },
      {
        id: 'acc-2500',
        code: '2500',
        name: 'Long-term Liabilities',
        type: 'liability',
        normalBalance: 'credit',
        parentId: 'acc-2000',
        isPostable: false,
        isActive: true,
        balance: 50000,
        children: [
          { id: 'acc-2510', code: '2510', name: 'Bank Loan', type: 'liability', normalBalance: 'credit', parentId: 'acc-2500', isPostable: true, isActive: true, balance: 50000 }
        ]
      }
    ]
  },
  // Equity (3000-3999)
  {
    id: 'acc-3000',
    code: '3000',
    name: 'Equity',
    type: 'equity',
    normalBalance: 'credit',
    parentId: null,
    isPostable: false,
    isActive: true,
    balance: 340000,
    children: [
      { id: 'acc-3100', code: '3100', name: 'Share Capital', type: 'equity', normalBalance: 'credit', parentId: 'acc-3000', isPostable: true, isActive: true, balance: 100000 },
      { id: 'acc-3200', code: '3200', name: 'Retained Earnings', type: 'equity', normalBalance: 'credit', parentId: 'acc-3000', isPostable: true, isActive: true, balance: 185000 },
      { id: 'acc-3300', code: '3300', name: 'Current Year Earnings', type: 'equity', normalBalance: 'credit', parentId: 'acc-3000', isPostable: true, isActive: true, balance: 55000 }
    ]
  },
  // Income (4000-4999)
  {
    id: 'acc-4000',
    code: '4000',
    name: 'Income',
    type: 'income',
    normalBalance: 'credit',
    parentId: null,
    isPostable: false,
    isActive: true,
    balance: 425000,
    children: [
      { id: 'acc-4100', code: '4100', name: 'Service Revenue', type: 'income', normalBalance: 'credit', parentId: 'acc-4000', isPostable: true, isActive: true, balance: 350000 },
      { id: 'acc-4200', code: '4200', name: 'Product Sales', type: 'income', normalBalance: 'credit', parentId: 'acc-4000', isPostable: true, isActive: true, balance: 65000 },
      { id: 'acc-4300', code: '4300', name: 'Other Revenue', type: 'income', normalBalance: 'credit', parentId: 'acc-4000', isPostable: true, isActive: true, balance: 10000 }
    ]
  },
  // Expenses (5000-5999)
  {
    id: 'acc-5000',
    code: '5000',
    name: 'Expenses',
    type: 'expense',
    normalBalance: 'debit',
    parentId: null,
    isPostable: false,
    isActive: true,
    balance: 370000,
    children: [
      { id: 'acc-5100', code: '5100', name: 'Salaries & Wages', type: 'expense', normalBalance: 'debit', parentId: 'acc-5000', isPostable: true, isActive: true, balance: 180000 },
      { id: 'acc-5200', code: '5200', name: 'Rent Expense', type: 'expense', normalBalance: 'debit', parentId: 'acc-5000', isPostable: true, isActive: true, balance: 48000 },
      { id: 'acc-5300', code: '5300', name: 'Utilities', type: 'expense', normalBalance: 'debit', parentId: 'acc-5000', isPostable: true, isActive: true, balance: 12000 },
      { id: 'acc-5400', code: '5400', name: 'Insurance', type: 'expense', normalBalance: 'debit', parentId: 'acc-5000', isPostable: true, isActive: true, balance: 15000 },
      { id: 'acc-5500', code: '5500', name: 'Professional Fees', type: 'expense', normalBalance: 'debit', parentId: 'acc-5000', isPostable: true, isActive: true, balance: 25000 },
      { id: 'acc-5600', code: '5600', name: 'Marketing & Advertising', type: 'expense', normalBalance: 'debit', parentId: 'acc-5000', isPostable: true, isActive: true, balance: 35000 },
      { id: 'acc-5700', code: '5700', name: 'Office Supplies', type: 'expense', normalBalance: 'debit', parentId: 'acc-5000', isPostable: true, isActive: true, balance: 8000 },
      { id: 'acc-5800', code: '5800', name: 'Depreciation Expense', type: 'expense', normalBalance: 'debit', parentId: 'acc-5000', isPostable: true, isActive: true, balance: 40000 },
      { id: 'acc-5900', code: '5900', name: 'Miscellaneous Expense', type: 'expense', normalBalance: 'debit', parentId: 'acc-5000', isPostable: true, isActive: true, balance: 7000 }
    ]
  }
];

export const trialBalance: TrialBalanceRow[] = [
  { accountId: 'acc-1110', accountCode: '1110', accountName: 'Cash on Hand', accountType: 'asset', openingBalance: 3000, debits: 5000, credits: 3000, closingBalance: 5000 },
  { accountId: 'acc-1120', accountCode: '1120', accountName: 'Bank - Operating', accountType: 'asset', openingBalance: 100000, debits: 350000, credits: 325000, closingBalance: 125000 },
  { accountId: 'acc-1130', accountCode: '1130', accountName: 'Bank - Savings', accountType: 'asset', openingBalance: 50000, debits: 25000, credits: 0, closingBalance: 75000 },
  { accountId: 'acc-1200', accountCode: '1200', accountName: 'Accounts Receivable', accountType: 'asset', openingBalance: 45000, debits: 425000, credits: 405000, closingBalance: 65000 },
  { accountId: 'acc-1300', accountCode: '1300', accountName: 'Prepaid Expenses', accountType: 'asset', openingBalance: 18000, debits: 15000, credits: 18000, closingBalance: 15000 },
  { accountId: 'acc-1510', accountCode: '1510', accountName: 'Equipment', accountType: 'asset', openingBalance: 150000, debits: 0, credits: 0, closingBalance: 150000 },
  { accountId: 'acc-1530', accountCode: '1530', accountName: 'Furniture & Fixtures', accountType: 'asset', openingBalance: 50000, debits: 0, credits: 0, closingBalance: 50000 },
  { accountId: 'acc-2110', accountCode: '2110', accountName: 'Accounts Payable', accountType: 'liability', openingBalance: 35000, debits: 280000, credits: 290000, closingBalance: 45000 },
  { accountId: 'acc-2130', accountCode: '2130', accountName: 'GST/HST Payable', accountType: 'liability', openingBalance: 6500, debits: 45000, credits: 47000, closingBalance: 8500 },
  { accountId: 'acc-2140', accountCode: '2140', accountName: 'Payroll Liabilities', accountType: 'liability', openingBalance: 12000, debits: 144000, credits: 147500, closingBalance: 15500 },
  { accountId: 'acc-3100', accountCode: '3100', accountName: 'Share Capital', accountType: 'equity', openingBalance: 100000, debits: 0, credits: 0, closingBalance: 100000 },
  { accountId: 'acc-3200', accountCode: '3200', accountName: 'Retained Earnings', accountType: 'equity', openingBalance: 185000, debits: 0, credits: 0, closingBalance: 185000 },
  { accountId: 'acc-4100', accountCode: '4100', accountName: 'Service Revenue', accountType: 'income', openingBalance: 0, debits: 0, credits: 350000, closingBalance: 350000 },
  { accountId: 'acc-4200', accountCode: '4200', accountName: 'Product Sales', accountType: 'income', openingBalance: 0, debits: 0, credits: 65000, closingBalance: 65000 },
  { accountId: 'acc-5100', accountCode: '5100', accountName: 'Salaries & Wages', accountType: 'expense', openingBalance: 0, debits: 180000, credits: 0, closingBalance: 180000 },
  { accountId: 'acc-5200', accountCode: '5200', accountName: 'Rent Expense', accountType: 'expense', openingBalance: 0, debits: 48000, credits: 0, closingBalance: 48000 },
  { accountId: 'acc-5300', accountCode: '5300', accountName: 'Utilities', accountType: 'expense', openingBalance: 0, debits: 12000, credits: 0, closingBalance: 12000 },
  { accountId: 'acc-5600', accountCode: '5600', accountName: 'Marketing & Advertising', accountType: 'expense', openingBalance: 0, debits: 35000, credits: 0, closingBalance: 35000 },
];

export const customers: Customer[] = [
  { id: 'cust-1', name: 'ABC Technologies', email: 'billing@abctech.com', phone: '416-555-0101', balance: 15000 },
  { id: 'cust-2', name: 'Global Solutions Inc.', email: 'ap@globalsolutions.com', phone: '604-555-0202', balance: 8500 },
  { id: 'cust-3', name: 'Northern Consulting', email: 'finance@northern.ca', phone: '403-555-0303', balance: 22000 },
  { id: 'cust-4', name: 'Metro Services Ltd.', email: 'accounts@metroservices.com', phone: '514-555-0404', balance: 5200 },
  { id: 'cust-5', name: 'Pacific Enterprises', email: 'billing@pacificent.com', phone: '778-555-0505', balance: 14300 }
];

export const vendors: Vendor[] = [
  { id: 'vend-1', name: 'Office Supplies Plus', email: 'orders@officesupplies.com', phone: '416-555-1001', balance: 2500 },
  { id: 'vend-2', name: 'TechEquip Solutions', email: 'sales@techequip.com', phone: '604-555-1002', balance: 15000 },
  { id: 'vend-3', name: 'CloudHost Services', email: 'billing@cloudhost.com', phone: '800-555-1003', balance: 4200 },
  { id: 'vend-4', name: 'Marketing Pro Agency', email: 'accounts@marketingpro.com', phone: '416-555-1004', balance: 8500 }
];

export const invoices: Invoice[] = [
  {
    id: 'inv-1',
    number: 'INV-2024-001',
    customerId: 'cust-1',
    customerName: 'ABC Technologies',
    date: new Date('2024-12-01'),
    dueDate: new Date('2024-12-31'),
    items: [{ description: 'Consulting Services - December', quantity: 40, unitPrice: 150, accountId: 'acc-4100', taxCode: 'HST', amount: 6000 }],
    subtotal: 6000,
    taxAmount: 780,
    total: 6780,
    amountPaid: 0,
    status: 'sent'
  },
  {
    id: 'inv-2',
    number: 'INV-2024-002',
    customerId: 'cust-3',
    customerName: 'Northern Consulting',
    date: new Date('2024-12-05'),
    dueDate: new Date('2025-01-04'),
    items: [{ description: 'Software Development', quantity: 80, unitPrice: 175, accountId: 'acc-4100', taxCode: 'HST', amount: 14000 }],
    subtotal: 14000,
    taxAmount: 1820,
    total: 15820,
    amountPaid: 15820,
    status: 'paid'
  },
  {
    id: 'inv-3',
    number: 'INV-2024-003',
    customerId: 'cust-2',
    customerName: 'Global Solutions Inc.',
    date: new Date('2024-11-15'),
    dueDate: new Date('2024-12-15'),
    items: [{ description: 'System Integration', quantity: 60, unitPrice: 200, accountId: 'acc-4100', taxCode: 'HST', amount: 12000 }],
    subtotal: 12000,
    taxAmount: 1560,
    total: 13560,
    amountPaid: 0,
    status: 'overdue'
  }
];

export const bankAccounts: BankAccount[] = [
  { id: 'bank-1', name: 'Operating Account', accountNumber: '****4521', institution: 'TD Canada Trust', currency: 'CAD', balance: 125000, lastReconciled: new Date('2024-12-31') },
  { id: 'bank-2', name: 'Savings Account', accountNumber: '****7832', institution: 'TD Canada Trust', currency: 'CAD', balance: 75000, lastReconciled: new Date('2024-12-31') },
  { id: 'bank-3', name: 'USD Account', accountNumber: '****9012', institution: 'RBC Royal Bank', currency: 'USD', balance: 25000 }
];

export const taxCodes: TaxCode[] = [
  { id: 'tax-1', code: 'HST-ON', name: 'HST Ontario', rate: 13, jurisdiction: 'Ontario', isRecoverable: true, isActive: true },
  { id: 'tax-2', code: 'GST', name: 'GST', rate: 5, jurisdiction: 'Federal', isRecoverable: true, isActive: true },
  { id: 'tax-3', code: 'QST', name: 'QST Quebec', rate: 9.975, jurisdiction: 'Quebec', isRecoverable: true, isActive: true },
  { id: 'tax-4', code: 'PST-BC', name: 'PST British Columbia', rate: 7, jurisdiction: 'British Columbia', isRecoverable: false, isActive: true },
  { id: 'tax-5', code: 'EXEMPT', name: 'Exempt', rate: 0, jurisdiction: 'All', isRecoverable: false, isActive: true },
  { id: 'tax-6', code: 'ZERO', name: 'Zero Rated', rate: 0, jurisdiction: 'All', isRecoverable: true, isActive: true }
];

export const employees: Employee[] = [
  { id: 'emp-1', employeeNumber: 'EMP001', firstName: 'Sarah', lastName: 'Johnson', email: 'sarah.johnson@company.com', department: 'Engineering', position: 'Senior Developer', payType: 'salary', payRate: 95000, startDate: new Date('2022-03-15'), isActive: true },
  { id: 'emp-2', employeeNumber: 'EMP002', firstName: 'Michael', lastName: 'Chen', email: 'michael.chen@company.com', department: 'Sales', position: 'Sales Manager', payType: 'salary', payRate: 85000, startDate: new Date('2021-08-01'), isActive: true },
  { id: 'emp-3', employeeNumber: 'EMP003', firstName: 'Emily', lastName: 'Williams', email: 'emily.williams@company.com', department: 'Finance', position: 'Accountant', payType: 'salary', payRate: 72000, startDate: new Date('2023-01-10'), isActive: true },
  { id: 'emp-4', employeeNumber: 'EMP004', firstName: 'David', lastName: 'Brown', email: 'david.brown@company.com', department: 'Operations', position: 'Operations Coordinator', payType: 'hourly', payRate: 28, startDate: new Date('2023-06-20'), isActive: true }
];

export const journalEntries: JournalEntry[] = [
  {
    id: 'je-1',
    date: new Date('2024-12-31'),
    reference: 'JE-2024-125',
    description: 'Record December revenue accrual',
    lines: [
      { accountId: 'acc-1200', accountName: 'Accounts Receivable', accountCode: '1200', debit: 15000, credit: 0 },
      { accountId: 'acc-4100', accountName: 'Service Revenue', accountCode: '4100', debit: 0, credit: 15000 }
    ],
    currency: 'CAD',
    status: 'posted',
    createdBy: 'Emily Williams',
    createdAt: new Date('2024-12-31')
  },
  {
    id: 'je-2',
    date: new Date('2024-12-31'),
    reference: 'JE-2024-126',
    description: 'Record December payroll expense',
    lines: [
      { accountId: 'acc-5100', accountName: 'Salaries & Wages', accountCode: '5100', debit: 45000, credit: 0 },
      { accountId: 'acc-2140', accountName: 'Payroll Liabilities', accountCode: '2140', debit: 0, credit: 12500 },
      { accountId: 'acc-1120', accountName: 'Bank - Operating', accountCode: '1120', debit: 0, credit: 32500 }
    ],
    currency: 'CAD',
    status: 'posted',
    createdBy: 'Emily Williams',
    createdAt: new Date('2024-12-31')
  }
];

export const dashboardStats = {
  totalRevenue: 425000,
  totalExpenses: 370000,
  netIncome: 55000,
  cashBalance: 205000,
  accountsReceivable: 65000,
  accountsPayable: 45000,
  revenueGrowth: 12.5,
  expenseGrowth: 8.2
};

export const monthlyRevenue = [
  { month: 'Jan', revenue: 32000, expenses: 28000 },
  { month: 'Feb', revenue: 35000, expenses: 29500 },
  { month: 'Mar', revenue: 38000, expenses: 31000 },
  { month: 'Apr', revenue: 36000, expenses: 30000 },
  { month: 'May', revenue: 42000, expenses: 33000 },
  { month: 'Jun', revenue: 40000, expenses: 32000 },
  { month: 'Jul', revenue: 38000, expenses: 31500 },
  { month: 'Aug', revenue: 35000, expenses: 30000 },
  { month: 'Sep', revenue: 37000, expenses: 31000 },
  { month: 'Oct', revenue: 42000, expenses: 34000 },
  { month: 'Nov', revenue: 45000, expenses: 35000 },
  { month: 'Dec', revenue: 50000, expenses: 38000 }
];

export const expenseBreakdown = [
  { name: 'Salaries', value: 180000, color: 'hsl(var(--chart-1))' },
  { name: 'Rent', value: 48000, color: 'hsl(var(--chart-2))' },
  { name: 'Marketing', value: 35000, color: 'hsl(var(--chart-3))' },
  { name: 'Professional Fees', value: 25000, color: 'hsl(var(--chart-4))' },
  { name: 'Other', value: 82000, color: 'hsl(var(--chart-5))' }
];
