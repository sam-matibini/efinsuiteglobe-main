import {
  endOfMonth,
  endOfQuarter,
  endOfWeek,
  endOfYear,
  format,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
  startOfYear,
  subDays,
  subMonths,
  subQuarters,
  subWeeks,
  subYears,
} from 'date-fns';

/** Monday-start weeks, matching the rest of the accounting calendar. */
const WEEK = { weekStartsOn: 1 as const };

export interface BankingDateBounds {
  start: string;
  end: string;
}

export interface BankingDateRangeOption {
  value: string;
  label: string;
  group: 'all' | 'current' | 'previous' | 'custom';
}

/**
 * Presets follow the Zoho Books date list: the current period, the previous
 * period, and a few rolling ranges, plus all time and a custom range.
 */
export const BANKING_DATE_RANGE_OPTIONS: BankingDateRangeOption[] = [
  { value: 'all', label: 'All Time', group: 'all' },
  { value: 'today', label: 'Today', group: 'current' },
  { value: 'this-week', label: 'This Week', group: 'current' },
  { value: 'this-month', label: 'This Month', group: 'current' },
  { value: 'this-quarter', label: 'This Quarter', group: 'current' },
  { value: 'this-year', label: 'This Year', group: 'current' },
  { value: 'year-to-date', label: 'Year to Date', group: 'current' },
  { value: 'yesterday', label: 'Yesterday', group: 'previous' },
  { value: 'last-week', label: 'Last Week', group: 'previous' },
  { value: 'last-month', label: 'Last Month', group: 'previous' },
  { value: 'last-quarter', label: 'Last Quarter', group: 'previous' },
  { value: 'last-3-months', label: 'Last 3 Months', group: 'previous' },
  { value: 'last-6-months', label: 'Last 6 Months', group: 'previous' },
  { value: 'last-12-months', label: 'Last 12 Months', group: 'previous' },
  { value: 'last-year', label: 'Last Year', group: 'previous' },
  { value: 'custom', label: 'Custom Range', group: 'custom' },
];

function iso(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

export function bankingDateBounds(
  key: string,
  now = new Date(),
  custom?: { start?: Date | null; end?: Date | null },
): BankingDateBounds | null {
  switch (key) {
    case 'today':
      return { start: iso(now), end: iso(now) };
    case 'yesterday': {
      const day = subDays(now, 1);
      return { start: iso(day), end: iso(day) };
    }
    case 'this-week':
      return { start: iso(startOfWeek(now, WEEK)), end: iso(endOfWeek(now, WEEK)) };
    case 'last-week': {
      const week = subWeeks(now, 1);
      return { start: iso(startOfWeek(week, WEEK)), end: iso(endOfWeek(week, WEEK)) };
    }
    case 'this-month':
      return { start: iso(startOfMonth(now)), end: iso(endOfMonth(now)) };
    case 'last-month': {
      const month = subMonths(now, 1);
      return { start: iso(startOfMonth(month)), end: iso(endOfMonth(month)) };
    }
    case 'this-quarter':
      return { start: iso(startOfQuarter(now)), end: iso(endOfQuarter(now)) };
    case 'last-quarter': {
      const quarter = subQuarters(now, 1);
      return { start: iso(startOfQuarter(quarter)), end: iso(endOfQuarter(quarter)) };
    }
    case 'last-3-months':
      return { start: iso(startOfMonth(subMonths(now, 2))), end: iso(endOfMonth(now)) };
    case 'last-6-months':
      return { start: iso(startOfMonth(subMonths(now, 5))), end: iso(endOfMonth(now)) };
    case 'last-12-months':
      return { start: iso(startOfMonth(subMonths(now, 11))), end: iso(endOfMonth(now)) };
    case 'this-year':
      return { start: iso(startOfYear(now)), end: iso(endOfYear(now)) };
    case 'year-to-date':
      return { start: iso(startOfYear(now)), end: iso(now) };
    case 'last-year': {
      const year = subYears(now, 1);
      return { start: iso(startOfYear(year)), end: iso(endOfYear(year)) };
    }
    case 'custom': {
      if (!custom?.start || !custom?.end) return null;
      const start = iso(custom.start);
      const end = iso(custom.end);
      return start <= end ? { start, end } : { start: end, end: start };
    }
    default:
      return null;
  }
}

export function isWithinBankingDateRange(transactionDate: string, bounds: BankingDateBounds | null): boolean {
  if (!bounds) return true;
  const day = transactionDate.slice(0, 10);
  return day >= bounds.start && day <= bounds.end;
}
