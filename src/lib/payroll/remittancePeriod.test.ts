import { describe, expect, it } from 'vitest';
import { belongsToRemittanceMonth, craRemittanceAccounts, remittanceMonthFor, remittanceMonthRange } from './remittancePeriod';

describe('PD7A remittance month', () => {
  it('assigns a pay run to the month its pay period ends in', () => {
    // Sep 22 – Oct 5 ends in October, so it goes on the October PD7A.
    expect(remittanceMonthFor('2026-10-05')).toBe('2026-10');
    expect(belongsToRemittanceMonth('2026-10-05', '2026-10')).toBe(true);
    expect(belongsToRemittanceMonth('2026-10-05', '2026-09')).toBe(false);
    expect(belongsToRemittanceMonth('2026-09-30', '2026-09-01')).toBe(true);
    expect(belongsToRemittanceMonth('2026-10-31', '2026-10')).toBe(true);
    expect(belongsToRemittanceMonth('2026-11-01', '2026-10')).toBe(false);
  });

  it('builds the selection range and due date without time-zone drift', () => {
    expect(remittanceMonthRange('2026-10')).toEqual({
      period: '2026-10',
      startDate: '2026-10-01',
      endDate: '2026-10-31',
      dueDate: '2026-11-15',
    });
    expect(remittanceMonthRange('2026-12-01')).toMatchObject({ endDate: '2026-12-31', dueDate: '2027-01-15' });
    expect(remittanceMonthRange('2028-02')).toMatchObject({ endDate: '2028-02-29', dueDate: '2028-03-15' });
    expect(remittanceMonthRange('2026-09')).toMatchObject({ endDate: '2026-09-30' });
  });

  it('rejects a malformed period', () => {
    expect(() => remittanceMonthRange('October')).toThrow();
    expect(() => remittanceMonthRange('2026-13')).toThrow();
  });
});

describe('PD7A account numbers', () => {
  it('never shows a charity (RR) or other program account as the payroll account', () => {
    expect(craRemittanceAccounts({ business_number: '725966758RR0001', payroll_account_number: null })).toEqual({
      businessNumber: '725966758',
      payrollAccountNumber: undefined,
    });
  });

  it('uses the RP payroll account when one is on file', () => {
    expect(craRemittanceAccounts({ business_number: '725966758RR0001', payroll_account_number: '725966758 RP 0001' })).toEqual({
      businessNumber: '725966758',
      payrollAccountNumber: '725966758RP0001',
    });
    expect(craRemittanceAccounts({ business_number: '123456789RP0002' })).toEqual({
      businessNumber: '123456789',
      payrollAccountNumber: '123456789RP0002',
    });
  });
});
