import {
  startOfMonth,
  startOfQuarter,
  startOfYear,
  subMonths,
  subQuarters,
  subYears,
} from 'date-fns';
import { getFiscalYearEnd, getFiscalYearForDate, getFiscalYearStart } from '@/lib/fiscalYearUtils';

/**
 * Zoho Books-style reporting periods.
 * Month, quarter, and year presets are full calendar periods.
 * Year to Date and Fiscal Year to Date run through today.
 * Weeks start on Monday.
 */
export type DateRangePresetId =
  | 'all'
  | 'today'
  | 'this-week'
  | 'this-month'
  | 'this-quarter'
  | 'this-year'
  | 'yesterday'
  | 'last-week'
  | 'last-month'
  | 'last-quarter'
  | 'last-year'
  | 'year-to-date'
  | 'fiscal-year-to-date'
  | 'last-fiscal-year'
  | 'custom';

export interface DateRangeBounds {
  start: Date;
  end: Date;
}

export interface DateRangeIso {
  start: string;
  end: string;
}

export interface DateRangePresetOption {
  id: DateRangePresetId;
  label: string;
}

function localDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function mondayWeekStart(date: Date): Date {
  const day = localDay(date);
  const weekday = day.getDay();
  day.setDate(day.getDate() - ((weekday + 6) % 7));
  return day;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function monthEnd(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function quarterEnd(date: Date): Date {
  const quarter = Math.floor(date.getMonth() / 3);
  return new Date(date.getFullYear(), quarter * 3 + 3, 0);
}

function yearEnd(date: Date): Date {
  return new Date(date.getFullYear(), 11, 31);
}

export function toLocalISO(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function resolveDateRangePreset(
  preset: DateRangePresetId,
  now: Date = new Date(),
  fiscalYearEndMonth = 12,
): DateRangeBounds | null {
  if (preset === 'all' || preset === 'custom') return null;

  const today = localDay(now);
  switch (preset) {
    case 'today':
      return { start: today, end: today };
    case 'yesterday': {
      const yesterday = addDays(today, -1);
      return { start: yesterday, end: yesterday };
    }
    case 'this-week': {
      const start = mondayWeekStart(today);
      return { start, end: addDays(start, 6) };
    }
    case 'last-week': {
      const start = addDays(mondayWeekStart(today), -7);
      return { start, end: addDays(start, 6) };
    }
    case 'this-month':
      return { start: startOfMonth(today), end: monthEnd(today) };
    case 'last-month': {
      const lastMonth = subMonths(today, 1);
      return { start: startOfMonth(lastMonth), end: monthEnd(lastMonth) };
    }
    case 'this-quarter':
      return { start: startOfQuarter(today), end: quarterEnd(today) };
    case 'last-quarter': {
      const lastQuarter = subQuarters(today, 1);
      return { start: startOfQuarter(lastQuarter), end: quarterEnd(lastQuarter) };
    }
    case 'this-year':
      return { start: startOfYear(today), end: yearEnd(today) };
    case 'last-year': {
      const lastYear = subYears(today, 1);
      return { start: startOfYear(lastYear), end: yearEnd(lastYear) };
    }
    case 'year-to-date':
      return { start: startOfYear(today), end: today };
    case 'fiscal-year-to-date': {
      const fiscalYear = getFiscalYearForDate(today, fiscalYearEndMonth);
      return { start: getFiscalYearStart(fiscalYear, fiscalYearEndMonth), end: today };
    }
    case 'last-fiscal-year': {
      const fiscalYear = getFiscalYearForDate(today, fiscalYearEndMonth) - 1;
      return {
        start: getFiscalYearStart(fiscalYear, fiscalYearEndMonth),
        end: getFiscalYearEnd(fiscalYear, fiscalYearEndMonth),
      };
    }
    default:
      return null;
  }
}

export function resolveDateRangeISO(
  preset: DateRangePresetId,
  now: Date = new Date(),
  fiscalYearEndMonth = 12,
): DateRangeIso | null {
  const bounds = resolveDateRangePreset(preset, now, fiscalYearEndMonth);
  if (!bounds) return null;
  return { start: toLocalISO(bounds.start), end: toLocalISO(bounds.end) };
}

export function dateInIsoRange(value: string, range: DateRangeIso | null): boolean {
  if (!range?.start || !range?.end) return true;
  const day = value.substring(0, 10);
  return day >= range.start && day <= range.end;
}

export function detectDateRangePreset(
  start: Date,
  end: Date,
  candidates: readonly DateRangePresetId[],
  now: Date = new Date(),
  fiscalYearEndMonth = 12,
): DateRangePresetId {
  const startIso = toLocalISO(start);
  const endIso = toLocalISO(end);
  const fiscalFirst = ['last-fiscal-year', 'fiscal-year-to-date'] as const;
  const ordered = [
    ...fiscalFirst.filter((id) => candidates.includes(id)),
    ...candidates.filter((id) => id !== 'last-fiscal-year' && id !== 'fiscal-year-to-date'),
  ];
  for (const id of ordered) {
    const bounds = resolveDateRangePreset(id, now, fiscalYearEndMonth);
    if (!bounds) continue;
    if (toLocalISO(bounds.start) === startIso && toLocalISO(bounds.end) === endIso) return id;
  }
  return 'custom';
}

const CURRENT_AND_PREVIOUS: DateRangePresetOption[] = [
  { id: 'today', label: 'Today' },
  { id: 'this-week', label: 'This Week' },
  { id: 'this-month', label: 'This Month' },
  { id: 'this-quarter', label: 'This Quarter' },
  { id: 'this-year', label: 'This Year' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'last-week', label: 'Last Week' },
  { id: 'last-month', label: 'Last Month' },
  { id: 'last-quarter', label: 'Last Quarter' },
  { id: 'last-year', label: 'Last Year' },
  { id: 'year-to-date', label: 'Year to Date' },
];

export const BANKING_DATE_PRESETS: DateRangePresetOption[] = [
  { id: 'all', label: 'All Time' },
  ...CURRENT_AND_PREVIOUS,
  { id: 'custom', label: 'Custom Range' },
];

export const STATEMENT_DATE_PRESETS: DateRangePresetOption[] = [
  ...CURRENT_AND_PREVIOUS,
  { id: 'fiscal-year-to-date', label: 'Fiscal Year to Date' },
  { id: 'last-fiscal-year', label: 'Last Fiscal Year' },
  { id: 'custom', label: 'Custom' },
];

export const JOURNAL_DATE_PRESETS: DateRangePresetOption[] = [
  { id: 'all', label: 'All Time' },
  ...CURRENT_AND_PREVIOUS,
  { id: 'fiscal-year-to-date', label: 'Fiscal Year to Date' },
  { id: 'last-fiscal-year', label: 'Last Fiscal Year' },
];

export const STATEMENT_PRESET_IDS = STATEMENT_DATE_PRESETS.map((preset) => preset.id);
