import { describe, it, expect } from 'vitest';
import {
  getT3010CategoryLabel,
  getT3010CategoriesForAccountType,
  T3010_EXPENDITURE_CATEGORIES,
  T3010_REVENUE_CATEGORIES,
} from '../t3010Categories';

describe('T3010 Helper Functions', () => {
  it('getT3010CategoryLabel returns "Sch.6: 4500" for receipted_gifts', () => {
    expect(getT3010CategoryLabel('receipted_gifts')).toBe('Sch.6: 4500');
  });

  it('getT3010CategoryLabel returns null for null input', () => {
    expect(getT3010CategoryLabel(null)).toBeNull();
  });

  it('getT3010CategoryLabel returns null for unknown value', () => {
    expect(getT3010CategoryLabel('nonexistent_category')).toBeNull();
  });

  it('getT3010CategoriesForAccountType("expense") returns expenditure categories', () => {
    expect(getT3010CategoriesForAccountType('expense')).toBe(T3010_EXPENDITURE_CATEGORIES);
  });

  it('getT3010CategoriesForAccountType("income") returns revenue categories', () => {
    expect(getT3010CategoriesForAccountType('income')).toBe(T3010_REVENUE_CATEGORIES);
  });

  it('getT3010CategoriesForAccountType("asset") returns empty array', () => {
    expect(getT3010CategoriesForAccountType('asset')).toEqual([]);
  });
});
