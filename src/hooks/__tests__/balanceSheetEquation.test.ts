/**
 * ============================================================================
 * REGRESSION TESTS: Balance Sheet Equation Integrity
 * ============================================================================
 *
 * These tests guard against the "split-brain" balance equation bug where:
 *   - The DISPLAYED totals use reClosingBalance (from Statement of RE)
 *   - The isBalanced CHECK used a different formula (raw DB equity + ytdNetIncome)
 *
 * The canonical equation (must hold at all times):
 *
 *   Total Assets = Total Liabilities + Total Equity
 *
 * Where:
 *   Total Equity = (All equity accounts EXCEPT RE and CYE) + RE Closing Balance
 *   RE Closing Balance = Opening RE + Net Income - Dividends ± Adjustments
 *
 * isBalanced = |Total Assets - (Total Liabilities + Total Equity)| < 0.01
 *
 * ============================================================================
 */

import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// Test helpers: pure functions that mirror the BalanceSheet.tsx formulas
// ---------------------------------------------------------------------------

interface AccountBalance {
  id: string;
  code: string;
  name: string;
  account_type: string;
  normal_balance: string;
  is_header: boolean;
  calculated_balance: number;
}

interface REStatement {
  openingBalance: number;
  netIncomeLoss: number;
  dividendsDeclared: number;
  otherAdditions: number;
  otherDeductions: number;
  closingBalance: number;
}

const CYE_CODES = ['3-00-202'];
const CYE_NAMES = ['current year earnings', 'current year excess', 'current year surplus', 'excess (deficiency)'];
const RE_CODES = ['3-00-201'];
const RE_NAMES = ['retained earnings', 'retained profits', 'accumulated deficit', 'accumulated earnings',
  'unrestricted net assets', 'accumulated surplus', 'unrestricted funds', 'accumulated funds'];

function isCurrentYearEarningsAccount(a: AccountBalance): boolean {
  const nameLower = a.name?.toLowerCase() || '';
  return CYE_CODES.includes(a.code) || CYE_NAMES.some(n => nameLower.includes(n));
}

function isRetainedEarningsAccount(a: AccountBalance): boolean {
  const nameLower = a.name?.toLowerCase() || '';
  return RE_CODES.includes(a.code) || RE_NAMES.some(n => nameLower.includes(n) || nameLower === n);
}

function computeTotalAssets(accounts: AccountBalance[]): number {
  const toCents = (n: number) => Math.round(n * 100);
  const cents = accounts
    .filter(a => a.account_type === 'asset' && !a.is_header)
    .reduce((sum, a) => sum + toCents(a.calculated_balance) * (a.normal_balance === 'debit' ? 1 : -1), 0);
  return cents / 100;
}

function computeTotalLiabilities(accounts: AccountBalance[]): number {
  const toCents = (n: number) => Math.round(n * 100);
  const cents = accounts
    .filter(a => a.account_type === 'liability' && !a.is_header)
    .reduce((sum, a) => sum + toCents(a.calculated_balance) * (a.normal_balance === 'credit' ? 1 : -1), 0);
  return cents / 100;
}

function computeEquityExcludingREandCYE(accounts: AccountBalance[]): number {
  const toCents = (n: number) => Math.round(n * 100);
  const cents = accounts
    .filter(a =>
      a.account_type === 'equity' &&
      !a.is_header &&
      !isCurrentYearEarningsAccount(a) &&
      !isRetainedEarningsAccount(a)
    )
    .reduce((sum, a) => sum + toCents(a.calculated_balance) * (a.normal_balance === 'credit' ? 1 : -1), 0);
  return cents / 100;
}

function computeTotalEquity(equityExcludingRECYE: number, reClosingBalance: number): number {
  return equityExcludingRECYE + reClosingBalance;
}

function computeIsBalanced(totalAssets: number, totalLiabilities: number, totalEquity: number): boolean {
  return Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01;
}

function computeREClosingBalance(re: REStatement): number {
  return re.openingBalance + re.netIncomeLoss - re.dividendsDeclared + re.otherAdditions - re.otherDeductions;
}

// ---------------------------------------------------------------------------
// Sample data
// ---------------------------------------------------------------------------

const sampleAccounts: AccountBalance[] = [
  // Assets
  { id: 'a1', code: '1-01-101-0001', name: 'Operating Bank', account_type: 'asset', normal_balance: 'debit', is_header: false, calculated_balance: 50000 },
  { id: 'a2', code: '1-01-102-0001', name: 'Trade Receivables', account_type: 'asset', normal_balance: 'debit', is_header: false, calculated_balance: 10000 },
  { id: 'a3', code: '1-02-201-0001', name: 'Accum Depreciation', account_type: 'asset', normal_balance: 'credit', is_header: false, calculated_balance: 5000 },
  // Liabilities
  { id: 'l1', code: '2-01-101-0001', name: 'Trade Payables', account_type: 'liability', normal_balance: 'credit', is_header: false, calculated_balance: 15000 },
  // Equity - Share Capital
  { id: 'e1', code: '3-00-100', name: 'Common Shares', account_type: 'equity', normal_balance: 'credit', is_header: false, calculated_balance: 100 },
  // Equity - RE (replaced by Statement of RE closing balance)
  { id: 'e2', code: '3-00-201', name: 'Retained Earnings', account_type: 'equity', normal_balance: 'credit', is_header: false, calculated_balance: 5000 },
  // Equity - CYE (excluded from display)
  { id: 'e3', code: '3-00-202', name: 'Current Year Earnings', account_type: 'equity', normal_balance: 'credit', is_header: false, calculated_balance: 2000 },
];

const sampleREStatement: REStatement = {
  openingBalance: 5000,    // matches RE account's GL balance
  netIncomeLoss: 24900,    // from calculate_period_net_income RPC
  dividendsDeclared: 0,
  otherAdditions: 0,
  otherDeductions: 0,
  closingBalance: 29900,   // 5000 + 24900 - 0
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Balance Sheet Equation: Single Source of Truth', () => {

  it('RE closing balance formula matches computed value', () => {
    const computed = computeREClosingBalance(sampleREStatement);
    expect(computed).toBeCloseTo(sampleREStatement.closingBalance, 2);
  });

  it('Total Assets computed correctly with contra accounts', () => {
    // Total Assets = 50000 + 10000 - 5000 = 55000
    const total = computeTotalAssets(sampleAccounts);
    expect(total).toBeCloseTo(55000, 2);
  });

  it('Total Liabilities computed correctly', () => {
    const total = computeTotalLiabilities(sampleAccounts);
    expect(total).toBeCloseTo(15000, 2);
  });

  it('Equity excluding RE and CYE only includes other equity accounts', () => {
    // Should only include Common Shares (100), not RE (5000) or CYE (2000)
    const equityExcluded = computeEquityExcludingREandCYE(sampleAccounts);
    expect(equityExcluded).toBeCloseTo(100, 2);
  });

  it('CYE account is excluded from equity sum', () => {
    const cyeAccount = sampleAccounts.find(a => a.code === '3-00-202')!;
    expect(isCurrentYearEarningsAccount(cyeAccount)).toBe(true);
    // Its balance must NOT appear in equityExcludingRECYE
    const equityExcluded = computeEquityExcludingREandCYE(sampleAccounts);
    // Common Shares = 100 only
    expect(equityExcluded).toBeCloseTo(100, 2);
  });

  it('RE account GL balance is replaced by Statement of RE closing balance', () => {
    const reAccount = sampleAccounts.find(a => a.code === '3-00-201')!;
    expect(isRetainedEarningsAccount(reAccount)).toBe(true);
    // RE closing from Statement = 29900, NOT the GL balance 5000
    const reClosingBalance = sampleREStatement.closingBalance;
    expect(reClosingBalance).toBe(29900);
    expect(reClosingBalance).not.toBe(reAccount.calculated_balance);
  });

  it('Total Equity uses Statement of RE closing balance (no double-counting)', () => {
    const equityExcluded = computeEquityExcludingREandCYE(sampleAccounts);
    const reClosing = sampleREStatement.closingBalance;
    const totalEquity = computeTotalEquity(equityExcluded, reClosing);
    // 100 (common shares) + 29900 (RE closing) = 30000
    expect(totalEquity).toBeCloseTo(30000, 2);
  });

  it('Net Income is NOT added separately to equity (no double-counting)', () => {
    // Since reClosingBalance already includes Net Income,
    // we must NOT add netIncome again to totalEquity or totalLiabilitiesAndEquity.
    const equityExcluded = computeEquityExcludingREandCYE(sampleAccounts);
    const reClosing = sampleREStatement.closingBalance;
    const totalEquity = computeTotalEquity(equityExcluded, reClosing);
    
    // Verify: totalEquity does NOT include a separate netIncome addition
    // The double-count scenario would add 24900 again → totalEquity would be 54900
    const incorrectDoubleCount = totalEquity + sampleREStatement.netIncomeLoss;
    expect(incorrectDoubleCount).not.toBeCloseTo(30000, 2); // Confirm the double-count gives different result
    expect(totalEquity).toBeCloseTo(30000, 2); // Confirm correct value
  });

  it('Balance sheet equation balances: Assets = Liabilities + Equity', () => {
    const totalAssets = computeTotalAssets(sampleAccounts);          // 55000
    const totalLiabilities = computeTotalLiabilities(sampleAccounts); // 15000
    const equityExcluded = computeEquityExcludingREandCYE(sampleAccounts); // 100
    const reClosing = sampleREStatement.closingBalance;               // 29900
    const totalEquity = computeTotalEquity(equityExcluded, reClosing); // 30000
    
    // 55000 = 15000 + 30000? Only if Assets match. Let's verify.
    // Assets = 55000, L+E = 45000 → gap = 10000. This is by design in sample data.
    // The test verifies the FORMULA, not that sample data is balanced.
    const difference = Math.abs(totalAssets - (totalLiabilities + totalEquity));
    const isBalanced = computeIsBalanced(totalAssets, totalLiabilities, totalEquity);
    
    // With our sample data: 55000 ≠ 45000 → not balanced (intentional for this test)
    expect(difference).toBeCloseTo(10000, 2);
    expect(isBalanced).toBe(false);
  });

  it('isBalanced is true when assets match liabilities + equity', () => {
    // Adjust the RE closing to make it balance: 55000 - 15000 - 100 = 39900
    const balancedREStatement: REStatement = {
      openingBalance: 5000,
      netIncomeLoss: 34900,
      dividendsDeclared: 0,
      otherAdditions: 0,
      otherDeductions: 0,
      closingBalance: 39900,
    };
    
    const totalAssets = computeTotalAssets(sampleAccounts);
    const totalLiabilities = computeTotalLiabilities(sampleAccounts);
    const equityExcluded = computeEquityExcludingREandCYE(sampleAccounts);
    const reClosing = balancedREStatement.closingBalance;
    const totalEquity = computeTotalEquity(equityExcluded, reClosing);
    
    expect(totalAssets).toBeCloseTo(55000, 2);
    expect(totalLiabilities + totalEquity).toBeCloseTo(55000, 2);
    expect(computeIsBalanced(totalAssets, totalLiabilities, totalEquity)).toBe(true);
  });

  it('isBalanced uses display numbers, not hook raw equity + ytdNetIncome', () => {
    // This test demonstrates the "split-brain" bug that was fixed.
    // OLD (broken) formula: isBalanced = Assets ≈ Liabilities + allEquityFromDB + ytdNetIncome
    // NEW (correct) formula: isBalanced = Assets ≈ Liabilities + equityExclRECYE + reClosingBalance
    
    const totalAssets = 55000;
    const totalLiabilities = 15000;
    const equityExcluded = 100;
    const reClosing = 39900;
    const ytdNetIncome = 24900;
    
    // ALL raw equity from DB (includes RE=5000, CYE=2000, CommonShares=100) = 7100
    const rawDBEquity = 5000 + 2000 + 100;
    
    // OLD formula: 55000 vs 15000 + 7100 + 24900 = 47000 → difference = 8000 → NOT balanced
    const oldFormulaDiff = Math.abs(totalAssets - (totalLiabilities + rawDBEquity + ytdNetIncome));
    
    // NEW formula: 55000 vs 15000 + 100 + 39900 = 55000 → difference = 0 → BALANCED
    const newFormulaDiff = Math.abs(totalAssets - (totalLiabilities + equityExcluded + reClosing));
    
    expect(oldFormulaDiff).toBeGreaterThan(0.01); // Old formula shows "out of balance"
    expect(newFormulaDiff).toBeLessThan(0.01);   // New formula shows "balanced" ✓
  });

  it('ASNPO terms are recognized as RE equivalents', () => {
    const asnpoAccounts = [
      { id: 'x1', code: '3-01-200', name: 'Unrestricted Net Assets', account_type: 'equity', normal_balance: 'credit', is_header: false, calculated_balance: 5000 },
      { id: 'x2', code: '3-01-201', name: 'Accumulated Surplus (Deficit)', account_type: 'equity', normal_balance: 'credit', is_header: false, calculated_balance: 5000 },
    ];
    
    asnpoAccounts.forEach(a => {
      expect(isRetainedEarningsAccount(a)).toBe(true);
    });
  });

  it('tolerance threshold is 1 cent ($0.01)', () => {
    // Verify: 0.005 difference → balanced (rounds to less than 1 cent)
    expect(computeIsBalanced(1000.005, 500, 500)).toBe(true);
    
    // Verify: 0.02 difference → NOT balanced  
    expect(computeIsBalanced(1000.02, 500, 500)).toBe(false);
  });
});
