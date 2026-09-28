import { describe, expect, it } from 'vitest';
import {
  buildComparisonPeriods,
  entryFallsInPeriod,
  inclusiveDayCount,
  journalDateKey,
  reportLineAmount,
  shiftYears,
} from './financialCompare';

describe('buildComparisonPeriods', () => {
  it('builds contiguous prior windows for a fiscal year to date', () => {
    const periods = buildComparisonPeriods(
      new Date(2026, 0, 1),
      new Date(2026, 8, 28),
      { compareType: 'period', numberOfPeriods: 2, latestToOldest: true },
    );

    expect(periods).toHaveLength(2);
    expect(periods[0].endDate).toEqual(new Date(2025, 11, 31));
    expect(periods[0].startDate).toEqual(new Date(2025, 3, 5));
    expect(inclusiveDayCount(periods[0].startDate, periods[0].endDate)).toBe(
      inclusiveDayCount(new Date(2026, 0, 1), new Date(2026, 8, 28)),
    );
    expect(periods[1].endDate).toEqual(new Date(2025, 3, 4));
    expect(periods[1].endDate.getTime()).toBeLessThan(periods[0].startDate.getTime());
  });

  it('steps a full month back by calendar months', () => {
    const periods = buildComparisonPeriods(
      new Date(2026, 8, 1),
      new Date(2026, 8, 30),
      { compareType: 'period', numberOfPeriods: 2, latestToOldest: true },
    );
    expect(periods[0].startDate).toEqual(new Date(2026, 7, 1));
    expect(periods[0].endDate).toEqual(new Date(2026, 7, 31));
    expect(periods[1].startDate).toEqual(new Date(2026, 6, 1));
    expect(periods[1].endDate).toEqual(new Date(2026, 6, 31));
  });

  it('steps a full quarter back by calendar quarters', () => {
    const periods = buildComparisonPeriods(
      new Date(2026, 6, 1),
      new Date(2026, 8, 30),
      { compareType: 'period', numberOfPeriods: 1, latestToOldest: true },
    );
    expect(periods[0].startDate).toEqual(new Date(2026, 3, 1));
    expect(periods[0].endDate).toEqual(new Date(2026, 5, 30));
  });

  it('compares the same dates in prior years and clamps leap day', () => {
    const periods = buildComparisonPeriods(
      new Date(2024, 1, 29),
      new Date(2024, 8, 28),
      { compareType: 'year', numberOfPeriods: 1, latestToOldest: true },
    );
    expect(periods[0].startDate).toEqual(new Date(2023, 1, 28));
    expect(periods[0].endDate).toEqual(new Date(2023, 8, 28));
    expect(shiftYears(new Date(2024, 1, 29), 1)).toEqual(new Date(2023, 1, 28));
  });

  it('reverses to oldest first when requested', () => {
    const periods = buildComparisonPeriods(
      new Date(2026, 0, 1),
      new Date(2026, 0, 31),
      { compareType: 'year', numberOfPeriods: 2, latestToOldest: false },
    );
    expect(periods[0].endDate.getFullYear()).toBe(2024);
    expect(periods[1].endDate.getFullYear()).toBe(2025);
  });
});

describe('journal dates and amounts', () => {
  it('keeps a timestamped entry on its calendar day', () => {
    expect(journalDateKey('2025-12-31T05:00:00.000Z')).toBe('2025-12-31');
    expect(entryFallsInPeriod('2025-12-31T05:00:00.000Z', '2025-04-05', '2025-12-31')).toBe(true);
    expect(entryFallsInPeriod('2026-01-01', '2025-04-05', '2025-12-31')).toBe(false);
  });

  it('uses a stored base amount and fills a missing base from the foreign amount', () => {
    expect(reportLineAmount(18189.92, 100, 1)).toBe(18189.92);
    expect(reportLineAmount(0, 0, 1)).toBe(0);
    expect(reportLineAmount(null, 80, 1)).toBe(80);
    expect(reportLineAmount(0, 80, 1)).toBe(80);
    expect(reportLineAmount(0, 100, 1.35)).toBe(135);
  });
});
