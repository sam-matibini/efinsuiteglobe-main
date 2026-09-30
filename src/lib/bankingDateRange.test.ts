import { describe, expect, it } from 'vitest';
import { bankingDateBounds, isWithinBankingDateRange } from './bankingDateRange';

const now = new Date(2026, 8, 30, 15, 0, 0);

describe('banking date ranges', () => {
  it('matches Zoho-style current and previous periods', () => {
    expect(bankingDateBounds('today', now)).toEqual({ start: '2026-09-30', end: '2026-09-30' });
    expect(bankingDateBounds('yesterday', now)).toEqual({ start: '2026-09-29', end: '2026-09-29' });
    expect(bankingDateBounds('this-week', now)).toEqual({ start: '2026-09-28', end: '2026-10-04' });
    expect(bankingDateBounds('last-week', now)).toEqual({ start: '2026-09-21', end: '2026-09-27' });
    expect(bankingDateBounds('this-month', now)).toEqual({ start: '2026-09-01', end: '2026-09-30' });
    expect(bankingDateBounds('last-month', now)).toEqual({ start: '2026-08-01', end: '2026-08-31' });
    expect(bankingDateBounds('this-quarter', now)).toEqual({ start: '2026-07-01', end: '2026-09-30' });
    expect(bankingDateBounds('last-quarter', now)).toEqual({ start: '2026-04-01', end: '2026-06-30' });
    expect(bankingDateBounds('last-3-months', now)).toEqual({ start: '2026-07-01', end: '2026-09-30' });
    expect(bankingDateBounds('last-6-months', now)).toEqual({ start: '2026-04-01', end: '2026-09-30' });
    expect(bankingDateBounds('last-12-months', now)).toEqual({ start: '2025-10-01', end: '2026-09-30' });
    expect(bankingDateBounds('this-year', now)).toEqual({ start: '2026-01-01', end: '2026-12-31' });
    expect(bankingDateBounds('year-to-date', now)).toEqual({ start: '2026-01-01', end: '2026-09-30' });
    expect(bankingDateBounds('last-year', now)).toEqual({ start: '2025-01-01', end: '2025-12-31' });
  });

  it('keeps a September transaction in last quarter only when the quarter includes it', () => {
    expect(isWithinBankingDateRange('2026-09-21', bankingDateBounds('last-quarter', now))).toBe(false);
    expect(isWithinBankingDateRange('2026-09-21', bankingDateBounds('this-quarter', now))).toBe(true);
    expect(isWithinBankingDateRange('2025-11-02', bankingDateBounds('last-year', now))).toBe(true);
    expect(isWithinBankingDateRange('2026-09-21', bankingDateBounds('all', now))).toBe(true);
  });

  it('orders a custom range even when the dates are reversed', () => {
    expect(bankingDateBounds('custom', now, {
      start: new Date(2026, 8, 30),
      end: new Date(2026, 8, 1),
    })).toEqual({ start: '2026-09-01', end: '2026-09-30' });
  });
});
