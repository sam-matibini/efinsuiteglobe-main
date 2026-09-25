// Core Types for the Accounting Platform
// Industries are now centralized in src/data/industries.ts

import { IndustryType, isNpoIndustry } from '@/data/industries';

// Re-export for backwards compatibility
export type Industry = IndustryType;

// NPO/Charity industries that require ASNPO-compliant CoA and Donations module
export const NPO_INDUSTRIES: Industry[] = ['npo', 'charity', 'religious'];

// Re-export helper function
export { isNpoIndustry };

export type AccountType = 
  | 'asset'
  | 'liability'
  | 'equity'
  | 'income'
  | 'cogs'
  | 'expense'
  | 'other_income'
  | 'other_expense';

export type NormalBalance = 'debit' | 'credit';

export interface Organization {
  id: string;
  name: string;
  industry: Industry;
  baseCurrency: string;
  fiscalYearEnd: string; // MM-DD format
  taxRegistrations: TaxRegistration[];
  createdAt: Date;
  isActive: boolean;
}

export interface TaxRegistration {
  type: 'GST' | 'HST' | 'QST' | 'PST';
  number: string;
  jurisdiction: string;
}

export interface Account {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  normalBalance: NormalBalance;
  parentId: string | null;
  isPostable: boolean;
  isActive: boolean;
  description?: string;
  balance: number;
  children?: Account[];
}

export interface JournalEntry {
  id: string;
  date: Date;
  reference: string;
  description: string;
  lines: JournalLine[];
  currency: string;
  status: 'draft' | 'posted' | 'reversed';
  createdBy: string;
  createdAt: Date;
}

export interface JournalLine {
  accountId: string;
  accountName: string;
  accountCode: string;
  debit: number;
  credit: number;
  memo?: string;
}

export interface TrialBalanceRow {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: AccountType;
  openingBalance: number;
  debits: number;
  credits: number;
  closingBalance: number;
}

export interface FinancialPeriod {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  status: 'open' | 'closed' | 'locked';
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  taxNumber?: string;
  balance: number;
}

export interface Vendor {
  id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  taxNumber?: string;
  balance: number;
}

export interface Invoice {
  id: string;
  number: string;
  customerId: string;
  customerName: string;
  date: Date;
  dueDate: Date;
  items: InvoiceItem[];
  subtotal: number;
  taxAmount: number;
  total: number;
  amountPaid: number;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'void';
}

export interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  accountId: string;
  taxCode: string;
  amount: number;
}

export interface BankAccount {
  id: string;
  name: string;
  accountNumber: string;
  institution: string;
  currency: string;
  balance: number;
  lastReconciled?: Date;
}

export interface BankTransaction {
  id: string;
  bankAccountId: string;
  date: Date;
  description: string;
  amount: number;
  type: 'deposit' | 'withdrawal';
  status: 'unmatched' | 'matched' | 'reconciled';
  matchedJournalId?: string;
}

export interface TaxCode {
  id: string;
  code: string;
  name: string;
  rate: number;
  jurisdiction: string;
  isRecoverable: boolean;
  isActive: boolean;
}

export interface Employee {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  department: string;
  position: string;
  payType: 'salary' | 'hourly';
  payRate: number;
  startDate: Date;
  isActive: boolean;
}

export interface PayrollRun {
  id: string;
  periodStart: Date;
  periodEnd: Date;
  payDate: Date;
  status: 'draft' | 'approved' | 'paid';
  totalGross: number;
  totalDeductions: number;
  totalNet: number;
  employeeCount: number;
}
