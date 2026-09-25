import { describe, it, expect } from 'vitest';
import {
  calculateVariance,
  formatCurrencyForReport,
  alignAccounts,
  buildFinancialSection,
  analyzeVariances,
  validateBalanceSheetEquation,
  categorizeByCurrentNonCurrent,
  generatePeriodLabels,
  defaultDisplaySettings,
} from '../comparativeFinancialUtils';
import type { AlignedAccount } from '@/types/comparativeFinancials';

describe('calculateVariance', () => {
  it('positive variance', () => {
    const result = calculateVariance(1200, 1000);
    expect(result.amount).toBe(200);
    expect(result.percent).toBe(20);
  });

  it('negative variance', () => {
    const result = calculateVariance(800, 1000);
    expect(result.amount).toBe(-200);
    expect(result.percent).toBe(-20);
  });

  it('zero prior returns 100% when current is non-zero', () => {
    const result = calculateVariance(500, 0);
    expect(result.percent).toBe(100);
  });

  it('both zero returns neutral', () => {
    const result = calculateVariance(0, 0);
    expect(result.percent).toBe(0);
    expect(result.type).toBe('neutral');
  });
});

describe('formatCurrencyForReport', () => {
  it('brackets for negatives', () => {
    const result = formatCurrencyForReport(-1500, { ...defaultDisplaySettings, negativeValueFormat: 'brackets' });
    expect(result).toMatch(/^\(.+\)$/);
  });

  it('minus for negatives', () => {
    const result = formatCurrencyForReport(-1500, { ...defaultDisplaySettings, negativeValueFormat: 'minus' });
    expect(result).toMatch(/^-/);
  });

  it('thousands rounding with K suffix', () => {
    const result = formatCurrencyForReport(50000, { ...defaultDisplaySettings, roundingRule: 'thousands' });
    expect(result).toContain('K');
  });

  it('millions rounding with M suffix', () => {
    const result = formatCurrencyForReport(5000000, { ...defaultDisplaySettings, roundingRule: 'millions' });
    expect(result).toContain('M');
  });

  it('dollar sign prefix', () => {
    const result = formatCurrencyForReport(1000, defaultDisplaySettings, true);
    expect(result).toContain('$');
  });

  it('custom decimal places', () => {
    const result = formatCurrencyForReport(1234.567, { ...defaultDisplaySettings, decimalPlaces: 2 });
    expect(result).toContain('.');
  });
});

describe('alignAccounts', () => {
  const makeAccount = (id: string, code: string, name: string, balance: number) => ({
    id, code, name, account_type: 'asset', calculated_balance: balance, normal_balance: 'debit',
  });

  it('matches by code', () => {
    const current = [makeAccount('1', '1000', 'Cash', 500)];
    const prior = [makeAccount('1', '1000', 'Cash', 400)];
    const result = alignAccounts(current, prior, 'asset');
    expect(result.alignedAccounts[0].priorPeriodAmount).toBe(400);
  });

  it('matches by name fallback', () => {
    const current = [makeAccount('1', '1000', 'Cash', 500)];
    const prior = [makeAccount('2', '1001', 'Cash', 300)];
    const result = alignAccounts(current, prior, 'asset');
    expect(result.alignedAccounts[0].priorPeriodAmount).toBe(300);
  });

  it('flags new accounts in current period', () => {
    const current = [makeAccount('1', '1000', 'Cash', 500)];
    const prior: typeof current = [];
    const result = alignAccounts(current, prior, 'asset');
    expect(result.newAccountsInCurrent).toContain('1');
  });

  it('flags closed accounts from prior period', () => {
    const current: ReturnType<typeof makeAccount>[] = [];
    const prior = [makeAccount('1', '1000', 'OldAccount', 500)];
    const result = alignAccounts(current, prior, 'asset');
    expect(result.closedAccountsInPrior).toContain('1');
  });
});

describe('buildFinancialSection', () => {
  it('computes correct totals', () => {
    const accounts = [
      { currentPeriodAmount: 100, priorPeriodAmount: 80 },
      { currentPeriodAmount: 200, priorPeriodAmount: 150 },
    ] as AlignedAccount[];
    const section = buildFinancialSection('Assets', 'assets', true, accounts);
    expect(section.currentPeriodTotal).toBe(300);
    expect(section.priorPeriodTotal).toBe(230);
  });
});

describe('validateBalanceSheetEquation', () => {
  it('balanced returns true', () => {
    const result = validateBalanceSheetEquation(
      { current: 1000, prior: 900 },
      { current: 400, prior: 300 },
      { current: 500, prior: 500 },
      { current: 100, prior: 100 }
    );
    expect(result.currentBalanced).toBe(true);
    expect(result.priorBalanced).toBe(true);
  });

  it('unbalanced returns false with diff', () => {
    const result = validateBalanceSheetEquation(
      { current: 1000, prior: 900 },
      { current: 400, prior: 300 },
      { current: 400, prior: 500 },
      { current: 100, prior: 100 }
    );
    expect(result.currentBalanced).toBe(false);
    expect(result.currentDiff).toBe(100);
  });
});

describe('categorizeByCurrentNonCurrent', () => {
  it('separates by name patterns', () => {
    const accounts = [
      { accountName: 'Cash', accountCode: '1000' },
      { accountName: 'Property', accountCode: '1500' },
      { accountName: 'Equipment', accountCode: '1600' },
    ] as AlignedAccount[];
    const result = categorizeByCurrentNonCurrent(accounts);
    expect(result.current.length).toBe(1);
    expect(result.nonCurrent.length).toBe(2);
  });
});

describe('generatePeriodLabels', () => {
  it('annual period labels', () => {
    const result = generatePeriodLabels('2025-12-31', 'annual');
    expect(result.currentLabel).toBe('2025');
    expect(result.priorLabel).toBe('2024');
    expect(result.periodEndedLabel).toContain('Year Ended');
  });
});

describe('analyzeVariances', () => {
  it('high priority for 100%+ change', () => {
    const accounts = [{
      accountId: '1', accountName: 'Test', currentPeriodAmount: 200, priorPeriodAmount: 50,
      varianceAmount: 150, variancePercent: 300, isNewAccount: false, isClosedAccount: false,
    }] as AlignedAccount[];
    const result = analyzeVariances(accounts, 10);
    expect(result[0].priority).toBe('high');
  });

  it('skips insignificant variances', () => {
    const accounts = [{
      accountId: '1', accountName: 'Test', currentPeriodAmount: 100, priorPeriodAmount: 99,
      varianceAmount: 1, variancePercent: 1, isNewAccount: false, isClosedAccount: false,
    }] as AlignedAccount[];
    const result = analyzeVariances(accounts, 10);
    expect(result).toHaveLength(0);
  });
});
