// Report date range presets, laid out like Zoho Books' report date filter.
// "Year" and "Quarter" follow the organization's fiscal year; weeks start on Sunday.

import { addDays, addMonths, endOfMonth, endOfWeek, startOfMonth, startOfWeek, subWeeks } from 'date-fns';
import { getFiscalYearEnd, getFiscalYearForDate, getFiscalYearStart } from '@/lib/fiscalYearUtils';

export type DateRangePreset =
  | 'today'
  | 'this_week'
  | 'this_month'
  | 'this_quarter'
  | 'this_year'
  | 'yesterday'
  | 'previous_week'
  | 'previous_month'
  | 'previous_quarter'
  | 'previous_year'
  | 'custom';

export const DATE_RANGE_PRESETS: { key: Exclude<DateRangePreset, 'custom'>; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'this_week', label: 'This Week' },
  { key: 'this_month', label: 'This Month' },
  { key: 'this_quarter', label: 'This Quarter' },
  { key: 'this_year', label: 'This Year' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'previous_week', label: 'Previous Week' },
  { key: 'previous_month', label: 'Previous Month' },
  { key: 'previous_quarter', label: 'Previous Quarter' },
  { key: 'previous_year', label: 'Previous Year' },
];

export const PRESET_LABEL: Record<DateRangePreset, string> = {
  ...Object.fromEntries(DATE_RANGE_PRESETS.map((p) => [p.key, p.label])),
  custom: 'Custom',
} as Record<DateRangePreset, string>;

const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** Start of the fiscal quarter containing `d` (quarters run from the fiscal-year start month). */
function fiscalQuarterStart(d: Date, fiscalYearEndMonth: number): Date {
  const fyStart = getFiscalYearStart(getFiscalYearForDate(d, fiscalYearEndMonth), fiscalYearEndMonth);
  const monthsIn = (d.getFullYear() - fyStart.getFullYear()) * 12 + (d.getMonth() - fyStart.getMonth());
  return day(addMonths(fyStart, Math.floor(monthsIn / 3) * 3));
}

export function rangeForPreset(
  preset: Exclude<DateRangePreset, 'custom'>,
  now: Date = new Date(),
  fiscalYearEndMonth = 12,
): { start: Date; end: Date } {
  const today = day(now);
  const fy = getFiscalYearForDate(today, fiscalYearEndMonth);
  switch (preset) {
    case 'today':
      return { start: today, end: today };
    case 'yesterday': {
      const y = addDays(today, -1);
      return { start: y, end: y };
    }
    case 'this_week':
      return { start: day(startOfWeek(today)), end: day(endOfWeek(today)) };
    case 'previous_week': {
      const w = subWeeks(today, 1);
      return { start: day(startOfWeek(w)), end: day(endOfWeek(w)) };
    }
    case 'this_month':
      return { start: day(startOfMonth(today)), end: day(endOfMonth(today)) };
    case 'previous_month': {
      const m = addMonths(today, -1);
      return { start: day(startOfMonth(m)), end: day(endOfMonth(m)) };
    }
    case 'this_quarter': {
      const q = fiscalQuarterStart(today, fiscalYearEndMonth);
      return { start: q, end: day(endOfMonth(addMonths(q, 2))) };
    }
    case 'previous_quarter': {
      const q = addMonths(fiscalQuarterStart(today, fiscalYearEndMonth), -3);
      return { start: day(q), end: day(endOfMonth(addMonths(q, 2))) };
    }
    case 'this_year':
      return { start: day(getFiscalYearStart(fy, fiscalYearEndMonth)), end: day(getFiscalYearEnd(fy, fiscalYearEndMonth)) };
    case 'previous_year':
      return { start: day(getFiscalYearStart(fy - 1, fiscalYearEndMonth)), end: day(getFiscalYearEnd(fy - 1, fiscalYearEndMonth)) };
  }
}

const key = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

/** Which preset a range matches, or 'custom'. */
export function detectPreset(start: Date, end: Date, now: Date = new Date(), fiscalYearEndMonth = 12): DateRangePreset {
  for (const p of DATE_RANGE_PRESETS) {
    const r = rangeForPreset(p.key, now, fiscalYearEndMonth);
    if (key(r.start) === key(start) && key(r.end) === key(end)) return p.key;
  }
  return 'custom';
}
