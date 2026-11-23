import { describe, expect, it } from 'vitest';
import {
  dateInIsoRange,
  detectDateRangePreset,
  resolveDateRangeISO,
  resolveDateRangePreset,
  STATEMENT_PRESET_IDS,
} from './dateRangePresets';

const today = new Date(2026, 9, 3);

describe('Zoho-style date range presets', () => {
  it('uses full calendar periods for month, quarter, and year', () => {
    expect(resolveDateRangeISO('this-month', today)).toEqual({ start: '2026-10-01', end: '2026-10-31' });
    expect(resolveDateRangeISO('last-month', today)).toEqual({ start: '2026-09-01', end: '2026-09-30' });
    expect(resolveDateRangeISO('this-quarter', today)).toEqual({ start: '2026-10-01', end: '2026-12-31' });
    expect(resolveDateRangeISO('last-quarter', today)).toEqual({ start: '2026-07-01', end: '2026-09-30' });
    expect(resolveDateRangeISO('this-year', today)).toEqual({ start: '2026-01-01', end: '2026-12-31' });
    expect(resolveDateRangeISO('last-year', today)).toEqual({ start: '2025-01-01', end: '2025-12-31' });
  });

  it('uses Monday weeks and through-today ranges only for year to date', () => {
    expect(resolveDateRangeISO('today', today)).toEqual({ start: '2026-10-03', end: '2026-10-03' });
    expect(resolveDateRangeISO('yesterday', today)).toEqual({ start: '2026-10-02', end: '2026-10-02' });
    expect(resolveDateRangeISO('this-week', today)).toEqual({ start: '2026-09-28', end: '2026-10-04' });
    expect(resolveDateRangeISO('last-week', today)).toEqual({ start: '2026-09-21', end: '2026-09-27' });
    expect(resolveDateRangeISO('year-to-date', today)).toEqual({ start: '2026-01-01', end: '2026-10-03' });
    expect(resolveDateRangeISO('all', today)).toBeNull();
    expect(resolveDateRangeISO('custom', today)).toBeNull();
  });

  it('follows the organization fiscal year', () => {
    expect(resolveDateRangeISO('fiscal-year-to-date', today, 12)).toEqual({
      start: '2026-01-01',
      end: '2026-10-03',
    });
    expect(resolveDateRangeISO('last-fiscal-year', today, 12)).toEqual({
      start: '2025-01-01',
      end: '2025-12-31',
    });
    expect(resolveDateRangeISO('fiscal-year-to-date', today, 9)).toEqual({
      start: '2026-10-01',
      end: '2026-10-03',
    });
    expect(resolveDateRangeISO('last-fiscal-year', today, 9)).toEqual({
      start: '2025-10-01',
      end: '2026-09-30',
    });
  });

  it('includes both boundary days and recognizes a full month', () => {
    const month = resolveDateRangeISO('this-month', today)!;
    expect(dateInIsoRange('2026-10-01', month)).toBe(true);
    expect(dateInIsoRange('2026-10-31T15:00:00', month)).toBe(true);
    expect(dateInIsoRange('2026-09-30', month)).toBe(false);
    expect(dateInIsoRange('2026-10-15', null)).toBe(true);

    expect(detectDateRangePreset(new Date(2026, 9, 1), new Date(2026, 9, 31), STATEMENT_PRESET_IDS, today)).toBe('this-month');
    expect(detectDateRangePreset(new Date(2026, 9, 1), new Date(2026, 9, 3), STATEMENT_PRESET_IDS, today)).toBe('custom');
    expect(detectDateRangePreset(new Date(2025, 0, 1), new Date(2025, 11, 31), STATEMENT_PRESET_IDS, today, 12)).toBe('last-fiscal-year');
    expect(resolveDateRangePreset('this-year', today)!.end.getHours()).toBe(0);
  });
});
