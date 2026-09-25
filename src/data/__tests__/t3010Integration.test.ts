import { describe, it, expect } from 'vitest';
import {
  T3010_EXPENDITURE_CATEGORIES,
  T3010_REVENUE_CATEGORIES,
  ALL_T3010_CATEGORIES,
} from '../t3010Categories';

describe('T3010 Integration', () => {
  it('ALL_T3010_CATEGORIES equals union of revenue + expenditure', () => {
    expect(ALL_T3010_CATEGORIES).toEqual([...T3010_REVENUE_CATEGORIES, ...T3010_EXPENDITURE_CATEGORIES]);
  });

  it('all category values are unique', () => {
    const values = ALL_T3010_CATEGORIES.map(c => c.value);
    expect(new Set(values).size).toBe(values.length);
  });

  it('all line numbers are 4-digit strings', () => {
    for (const cat of ALL_T3010_CATEGORIES) {
      expect(cat.line).toMatch(/^\d{4}$/);
    }
  });
});
