import { describe, expect, it } from 'vitest';
import { detectPreset, rangeForPreset } from '../reportDateRanges';

const fmt = (r: { start: Date; end: Date }) =>
  [r.start, r.end].map((d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`).join(' → ');

// Wednesday 25 Nov 2026
const NOW = new Date(2026, 10, 25, 15, 30);

describe('report date range presets', () => {
  it('computes Zoho-style ranges for a calendar-year organization', () => {
    expect(fmt(rangeForPreset('today', NOW))).toBe('2026-11-25 → 2026-11-25');
    expect(fmt(rangeForPreset('yesterday', NOW))).toBe('2026-11-24 → 2026-11-24');
    expect(fmt(rangeForPreset('this_week', NOW))).toBe('2026-11-22 → 2026-11-28');
    expect(fmt(rangeForPreset('previous_week', NOW))).toBe('2026-11-15 → 2026-11-21');
    expect(fmt(rangeForPreset('this_month', NOW))).toBe('2026-11-01 → 2026-11-30');
    expect(fmt(rangeForPreset('previous_month', NOW))).toBe('2026-10-01 → 2026-10-31');
    expect(fmt(rangeForPreset('this_quarter', NOW))).toBe('2026-10-01 → 2026-12-31');
    expect(fmt(rangeForPreset('previous_quarter', NOW))).toBe('2026-07-01 → 2026-09-30');
    expect(fmt(rangeForPreset('this_year', NOW))).toBe('2026-01-01 → 2026-12-31');
    expect(fmt(rangeForPreset('previous_year', NOW))).toBe('2025-01-01 → 2025-12-31');
  });

  it('follows the fiscal year for years and quarters (September year end)', () => {
    expect(fmt(rangeForPreset('this_year', NOW, 9))).toBe('2026-10-01 → 2027-09-30');
    expect(fmt(rangeForPreset('previous_year', NOW, 9))).toBe('2025-10-01 → 2026-09-30');
    expect(fmt(rangeForPreset('this_quarter', NOW, 9))).toBe('2026-10-01 → 2026-12-31');
  });

  it('uses fiscal quarters that do not line up with calendar quarters (February year end → quarters start Mar/Jun/Sep/Dec)', () => {
    expect(fmt(rangeForPreset('this_quarter', NOW, 2))).toBe('2026-09-01 → 2026-11-30');
    expect(fmt(rangeForPreset('previous_quarter', NOW, 2))).toBe('2026-06-01 → 2026-08-31');
  });

  it('crosses year boundaries for previous periods', () => {
    const jan = new Date(2026, 0, 2);
    expect(fmt(rangeForPreset('previous_month', jan))).toBe('2025-12-01 → 2025-12-31');
    expect(fmt(rangeForPreset('previous_quarter', jan))).toBe('2025-10-01 → 2025-12-31');
    expect(fmt(rangeForPreset('previous_week', jan))).toBe('2025-12-21 → 2025-12-27');
  });

  it('recognises a preset from its dates, otherwise Custom', () => {
    expect(detectPreset(new Date(2026, 10, 1), new Date(2026, 10, 30), NOW)).toBe('this_month');
    expect(detectPreset(new Date(2025, 9, 1), new Date(2026, 8, 30), NOW, 9)).toBe('previous_year');
    expect(detectPreset(new Date(2025, 9, 1), new Date(2026, 10, 25), NOW, 9)).toBe('custom');
  });
});
