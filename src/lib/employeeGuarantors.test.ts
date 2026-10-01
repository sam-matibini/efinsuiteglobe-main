import { describe, expect, it } from 'vitest';
import { namedGuarantors } from './employeeGuarantors';

describe('optional employee guarantors', () => {
  it('keeps onboarding data when both guarantors are blank', () => {
    expect(namedGuarantors([
      { guarantor_order: 1, full_name: '   ', confirmed: false },
      { guarantor_order: 2, full_name: '', confirmed: true },
    ])).toEqual([]);
  });

  it('saves a named guarantor even when the confirmation box is unchecked', () => {
    expect(namedGuarantors([
      { guarantor_order: 1, full_name: ' Ada Lovelace ', confirmed: false },
      { guarantor_order: 2, full_name: '', confirmed: false },
    ])).toEqual([
      { guarantor_order: 1, full_name: 'Ada Lovelace', confirmed: false },
    ]);
  });
});
