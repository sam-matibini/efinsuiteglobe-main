import { describe, expect, it } from 'vitest';
import {
  DEFAULT_STATEMENT_SORT,
  readActiveStatementSort,
  sortIncomeStatementSections,
  statementSortSummary,
  upsertSavedStatementSort,
  writeActiveStatementSort,
} from './statementSort';

const expenses = [
  { code: '6100', name: 'Rent Expense', calculated_balance: 6213.61 },
  { code: '6400', name: 'Subcontractor Expenses', calculated_balance: 75386.49 },
  { code: '6200', name: 'Platforms and Partners Fees', calculated_balance: 73615 },
  { code: '6300', name: 'Utilities', calculated_balance: 46.09 },
];

const income = [
  { code: '4200', name: 'Service revenue', calculated_balance: 26000 },
  { code: '4000', name: 'Sales', calculated_balance: 200000 },
];

describe('statement line sort', () => {
  it('sorts expenses by amount and revenue by description without changing totals', () => {
    const criteria = {
      revenue: { by: 'description' as const, direction: 'desc' as const },
      expense: { by: 'amount' as const, direction: 'desc' as const },
    };
    const sorted = sortIncomeStatementSections({ income, cogs: [], expenses, otherIncome: [], otherExpenses: [] }, criteria);
    expect(sorted.expenses.map((item) => item.name)).toEqual([
      'Subcontractor Expenses',
      'Platforms and Partners Fees',
      'Rent Expense',
      'Utilities',
    ]);
    expect(sorted.income.map((item) => item.name)).toEqual(['Service revenue', 'Sales']);
    expect(sorted.expenses.reduce((sum, item) => sum + item.calculated_balance, 0)).toBeCloseTo(155261.19, 2);
  });

  it('keeps account-code order as the default and can save that choice', () => {
    const sorted = sortIncomeStatementSections({ income, expenses }, DEFAULT_STATEMENT_SORT);
    expect(sorted.expenses.map((item) => item.code)).toEqual(['6100', '6200', '6300', '6400']);
    const saved = upsertSavedStatementSort([], 'Largest expenses', {
      revenue: DEFAULT_STATEMENT_SORT.revenue,
      expense: { by: 'amount', direction: 'desc' },
    });
    expect(saved.saved?.name).toBe('Largest expenses');
    expect(upsertSavedStatementSort(saved.items, '   ', DEFAULT_STATEMENT_SORT).error).toBe('empty');
    writeActiveStatementSort('org-1', saved.saved!.value);
    expect(readActiveStatementSort('org-1').expense).toEqual({ by: 'amount', direction: 'desc' });
    expect(statementSortSummary(saved.saved!.value)).toContain('Expenses by amount, high to low');
  });
});
