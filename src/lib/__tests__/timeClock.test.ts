import { describe, it, expect } from 'vitest';
import {
  round2,
  minutesBetween,
  workedMinutes,
  splitDailyOvertime,
  workWeekStart,
  applyWeeklyOvertime,
  summarizePunches,
  currentPayPeriod,
  formatDuration,
} from '../timeClock';

const iso = (date: string, time: string) => `${date}T${time}:00.000Z`;

describe('timeClock helpers', () => {
  it('rounds to 2 decimals', () => {
    expect(round2(8.005)).toBeCloseTo(8.01, 2);
    expect(round2(1.234)).toBe(1.23);
    expect(round2(-0.001)).toBe(-0);
  });

  it('computes minutes between timestamps', () => {
    expect(minutesBetween(iso('2026-08-24', '09:00'), iso('2026-08-24', '17:30'))).toBe(510);
    expect(minutesBetween(iso('2026-08-24', '17:30'), iso('2026-08-24', '09:00'))).toBe(0);
  });

  it('subtracts breaks from worked minutes', () => {
    expect(workedMinutes(iso('2026-08-24', '09:00'), iso('2026-08-24', '17:00'), 45)).toBe(435);
    expect(workedMinutes(iso('2026-08-24', '09:00'), iso('2026-08-24', '17:00'))).toBe(480);
  });

  it('applies the daily overtime rule at 8 hours', () => {
    expect(splitDailyOvertime(6)).toEqual({ regularHours: 6, overtimeHours: 0 });
    expect(splitDailyOvertime(9)).toEqual({ regularHours: 8, overtimeHours: 1 });
    expect(splitDailyOvertime(12.25)).toEqual({ regularHours: 8, overtimeHours: 4.25 });
  });

  it('finds the Monday of a Mon-Sun work week', () => {
    expect(workWeekStart('2026-08-24')).toBe('2026-08-24'); // Monday
    expect(workWeekStart('2026-08-30')).toBe('2026-08-24'); // Sunday
    expect(workWeekStart('2026-08-29')).toBe('2026-08-24'); // Saturday
    expect(workWeekStart('2026-08-23')).toBe('2026-08-17'); // prior Sunday
  });

  it('moves weekly hours beyond 40 to overtime without double counting daily OT', () => {
    // Mon-Fri 9h each (all regular stays under 40 until Friday), plus a
    // Saturday shift whose hours must move to OT via the weekly rule.
    const shifts: Array<[string, string, string]> = [
      ['2026-08-24', '08:00', '17:00'],
      ['2026-08-25', '08:00', '17:00'],
      ['2026-08-26', '08:00', '17:00'],
      ['2026-08-27', '08:00', '17:00'],
      ['2026-08-28', '08:00', '17:00'],
      ['2026-08-29', '08:00', '14:00'], // Saturday
    ];
    const punches = shifts.map(([d], i) => ({
      id: `p${i}`,
      work_date: d,
      clock_in_at: iso(d, shifts[i][1]),
      clock_out_at: iso(d, shifts[i][2]),
      break_minutes: i === 5 ? 0 : 60,
    }));

    const result = applyWeeklyOvertime(punches);
    const totals = result.reduce(
      (acc, p) => ({ r: acc.r + p.regular_hours!, o: acc.o + p.overtime_hours! }),
      { r: 0, o: 0 },
    );

    // 46 worked hours -> 40 regular + 6 OT via the weekly cap
    expect(totals.r).toBe(40);
    expect(totals.o).toBe(6);
    // Monday-Friday fully regular (8h x 5)
    for (let i = 0; i < 4; i++) {
      expect(result[i].regular_hours).toBe(8);
      expect(result[i].overtime_hours).toBe(0);
    }
    expect(result[4].regular_hours).toBe(8);
    expect(result[4].overtime_hours).toBe(0);
    // Saturday's 6h overflow past the 40h weekly cap
    expect(result[5].regular_hours).toBe(0);
    expect(result[5].overtime_hours).toBe(6);
  });

  it('does not leak overtime across weeks', () => {
    const punches = [
      { id: 'a', work_date: '2026-08-28', clock_in_at: iso('2026-08-28', '08:00'), clock_out_at: iso('2026-08-28', '18:00') }, // Fri week A
      { id: 'b', work_date: '2026-08-31', clock_in_at: iso('2026-08-31', '08:00'), clock_out_at: iso('2026-08-31', '18:00') }, // Mon week B
    ];
    const result = applyWeeklyOvertime(punches);
    expect(result[0].regular_hours).toBe(8);
    expect(result[0].overtime_hours).toBe(2);
    expect(result[1].regular_hours).toBe(8);
    expect(result[1].overtime_hours).toBe(2);
  });

  it('summarizes period punches with weekly-aware splits and live shift', () => {
    const punches = [
      { id: '1', work_date: '2026-08-24', clock_in_at: iso('2026-08-24', '09:00'), clock_out_at: iso('2026-08-24', '17:00'), break_minutes: 60, status: 'closed' },
      { id: '2', work_date: '2026-08-25', clock_in_at: iso('2026-08-25', '09:00'), clock_out_at: iso('2026-08-25', '18:00'), break_minutes: 60, status: 'closed' },
      { id: '3', work_date: '2026-08-26', clock_in_at: iso('2026-08-26', '09:00'), clock_out_at: null, break_minutes: 15, status: 'open' },
    ];

    const summary = summarizePunches(punches);
    expect(summary.regularHours).toBe(15); // 7h + 8h
    expect(summary.overtimeHours).toBe(0);
    expect(summary.totalHours).toBeGreaterThanOrEqual(15);
  });

  it('resolves current pay periods per frequency', () => {
    // Wednesday
    const onDate = '2026-08-26';

    expect(currentPayPeriod('weekly', onDate)).toEqual({
      period_start: '2026-08-24',
      period_end: '2026-08-30',
    });

    // Fortnight anchored to Monday 2026-01-05 -> this week starts 2026-08-17
    expect(currentPayPeriod('bi_weekly', onDate)).toEqual({
      period_start: '2026-08-17',
      period_end: '2026-08-30',
    });
    // Second half of August
    expect(currentPayPeriod('semi_monthly', onDate)).toEqual({
      period_start: '2026-08-16',
      period_end: '2026-08-31',
    });
    // First half of August
    expect(currentPayPeriod('semi_monthly', '2026-08-05')).toEqual({
      period_start: '2026-08-01',
      period_end: '2026-08-15',
    });
    expect(currentPayPeriod('monthly', onDate)).toEqual({
      period_start: '2026-08-01',
      period_end: '2026-08-31',
    });
  });

  it('formats durations like a stopwatch', () => {
    expect(formatDuration(0)).toBe('0m');
    expect(formatDuration(59)).toBe('59m');
    expect(formatDuration(60)).toBe('1h 00m');
    expect(formatDuration(505)).toBe('8h 25m');
  });
});
