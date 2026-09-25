import { describe, it, expect } from 'vitest';
import { INDUSTRIES } from '../industries';

describe('Industry Configuration', () => {
  it('all industry values are unique', () => {
    const values = INDUSTRIES.map(i => i.value);
    expect(new Set(values).size).toBe(values.length);
  });

  it('all industries have valid accountingFramework', () => {
    const validFrameworks = ['ASPE', 'ASNPO', 'IFRS'];
    INDUSTRIES.forEach(ind => {
      expect(validFrameworks).toContain(ind.accountingFramework);
    });
  });

  it('NPO industries use ASNPO framework', () => {
    const npoIndustries = INDUSTRIES.filter(i => ['npo', 'charity', 'religious'].includes(i.value));
    npoIndustries.forEach(ind => {
      expect(ind.accountingFramework).toBe('ASNPO');
    });
  });

  it('cogsRequired and inventoryRequired are booleans', () => {
    INDUSTRIES.forEach(ind => {
      expect(typeof ind.cogsRequired).toBe('boolean');
      expect(typeof ind.inventoryRequired).toBe('boolean');
    });
  });

  it('last entry is "Other" (catch-all)', () => {
    const last = INDUSTRIES[INDUSTRIES.length - 1];
    expect(last.value).toBe('other');
    expect(last.label).toBe('Other');
  });
});
