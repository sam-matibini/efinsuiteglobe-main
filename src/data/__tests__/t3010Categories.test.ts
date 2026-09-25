import { describe, it, expect } from 'vitest';
import {
  T3010_EXPENDITURE_CATEGORIES,
  T3010_REVENUE_CATEGORIES,
  getT3010CategoryLabel,
  getT3010CategoriesForAccountType,
} from '../t3010Categories';

describe('T3010 Expenditure Categories', () => {
  it('contains exactly 5 categories', () => {
    expect(T3010_EXPENDITURE_CATEGORIES).toHaveLength(5);
  });

  it('has correct line numbers 4800-4840', () => {
    const lines = T3010_EXPENDITURE_CATEGORIES.map(c => c.line);
    expect(lines).toEqual(['4800', '4810', '4820', '4830', '4840']);
  });

  it('includes charitable_programs, management_admin, fundraising, political_activities, other_expenditures', () => {
    const values = T3010_EXPENDITURE_CATEGORIES.map(c => c.value);
    expect(values).toContain('charitable_programs');
    expect(values).toContain('management_admin');
    expect(values).toContain('fundraising');
    expect(values).toContain('political_activities');
    expect(values).toContain('other_expenditures');
  });
});

describe('T3010 Revenue Categories', () => {
  it('contains exactly 6 categories', () => {
    expect(T3010_REVENUE_CATEGORIES).toHaveLength(6);
  });

  it('has correct line numbers 4500-4570', () => {
    const lines = T3010_REVENUE_CATEGORIES.map(c => c.line);
    expect(lines).toEqual(['4500', '4510', '4530', '4540', '4560', '4570']);
  });
});

describe('getT3010CategoryLabel', () => {
  it('returns correct label for known value', () => {
    expect(getT3010CategoryLabel('charitable_programs')).toBe('Sch.6: 4800');
    expect(getT3010CategoryLabel('receipted_gifts')).toBe('Sch.6: 4500');
  });

  it('returns null for unknown value', () => {
    expect(getT3010CategoryLabel('nonexistent')).toBeNull();
  });

  it('returns null for null input', () => {
    expect(getT3010CategoryLabel(null)).toBeNull();
  });
});

describe('getT3010CategoriesForAccountType', () => {
  it('returns expenditure categories for expense', () => {
    expect(getT3010CategoriesForAccountType('expense')).toBe(T3010_EXPENDITURE_CATEGORIES);
  });

  it('returns revenue categories for income', () => {
    expect(getT3010CategoriesForAccountType('income')).toBe(T3010_REVENUE_CATEGORIES);
  });

  it('returns empty array for asset', () => {
    expect(getT3010CategoriesForAccountType('asset')).toEqual([]);
  });
});
