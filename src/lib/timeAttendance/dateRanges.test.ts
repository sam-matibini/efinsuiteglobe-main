import { describe, expect, it } from 'vitest';
import { dateRangeFor } from '@/pages/payroll/TimeAttendanceReports';

describe('attendance report dates', () => {
  const today = new Date(2026, 9, 3);

  it('uses the reporting presets', () => {
    expect(dateRangeFor('Today', today)).toEqual({ start: '2026-10-03', end: '2026-10-03' });
    expect(dateRangeFor('Yesterday', today)).toEqual({ start: '2026-10-02', end: '2026-10-02' });
    expect(dateRangeFor('This Month', today)).toEqual({ start: '2026-10-01', end: '2026-10-31' });
    expect(dateRangeFor('Last Month', today)).toEqual({ start: '2026-09-01', end: '2026-09-30' });
    expect(dateRangeFor('This Quarter', today)).toEqual({ start: '2026-10-01', end: '2026-12-31' });
    expect(dateRangeFor('This Year', today).start).toBe('2026-01-01');
  });
});
