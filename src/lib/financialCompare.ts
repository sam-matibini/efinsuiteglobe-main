/**
 * Shared compare-with windows and journal amount rules for financial statements.
 * Period headers and the dates that are queried must be the same range.
 */

export interface ComparisonRange {
  startDate: Date;
  endDate: Date;
}

export interface ComparePeriodSettings {
  compareType: 'period' | 'year';
  numberOfPeriods: number;
  latestToOldest?: boolean;
}

export function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addCalendarDays(date: Date, days: number): Date {
  const next = startOfLocalDay(date);
  next.setDate(next.getDate() + days);
  return next;
}

/** Inclusive calendar-day count. Jan 1 through Jan 1 is 1. */
export function inclusiveDayCount(start: Date, end: Date): number {
  const s = startOfLocalDay(start);
  const e = startOfLocalDay(end);
  const utcStart = Date.UTC(s.getFullYear(), s.getMonth(), s.getDate());
  const utcEnd = Date.UTC(e.getFullYear(), e.getMonth(), e.getDate());
  return Math.round((utcEnd - utcStart) / 86400000) + 1;
}

function lastDayOfMonth(year: number, monthIndex: number): Date {
  return new Date(year, monthIndex + 1, 0);
}

export function shiftYears(date: Date, years: number): Date {
  const source = startOfLocalDay(date);
  const month = source.getMonth();
  const shifted = new Date(source.getFullYear() - years, month, source.getDate());
  if (shifted.getMonth() !== month) {
    return lastDayOfMonth(source.getFullYear() - years, month);
  }
  return shifted;
}

function isCompleteMonth(start: Date, end: Date): boolean {
  const s = startOfLocalDay(start);
  const e = startOfLocalDay(end);
  if (s.getDate() !== 1 || s.getFullYear() !== e.getFullYear() || s.getMonth() !== e.getMonth()) {
    return false;
  }
  return e.getDate() === lastDayOfMonth(s.getFullYear(), s.getMonth()).getDate();
}

function isCompleteQuarter(start: Date, end: Date): boolean {
  const s = startOfLocalDay(start);
  const e = startOfLocalDay(end);
  if (s.getDate() !== 1 || ![0, 3, 6, 9].includes(s.getMonth())) return false;
  const quarterEnd = new Date(s.getFullYear(), s.getMonth() + 3, 0);
  return (
    e.getFullYear() === quarterEnd.getFullYear() &&
    e.getMonth() === quarterEnd.getMonth() &&
    e.getDate() === quarterEnd.getDate()
  );
}

function shiftCompleteMonth(start: Date, monthsBack: number): ComparisonRange {
  const s = startOfLocalDay(start);
  const shifted = new Date(s.getFullYear(), s.getMonth() - monthsBack, 1);
  return {
    startDate: shifted,
    endDate: lastDayOfMonth(shifted.getFullYear(), shifted.getMonth()),
  };
}

function shiftCompleteQuarter(start: Date, quartersBack: number): ComparisonRange {
  const s = startOfLocalDay(start);
  const shifted = new Date(s.getFullYear(), s.getMonth() - quartersBack * 3, 1);
  return {
    startDate: shifted,
    endDate: new Date(shifted.getFullYear(), shifted.getMonth() + 3, 0),
  };
}

/**
 * Previous periods are the same length as the selected range, immediately before it,
 * and they do not share a day with each other or with the current range.
 * A full calendar month or quarter steps by that calendar unit.
 * Previous years keep the same month and day, clamped on leap day.
 */
export function buildComparisonPeriods(
  startDate: Date,
  endDate: Date,
  settings: ComparePeriodSettings,
): ComparisonRange[] {
  const count = Math.max(0, Math.floor(Number(settings.numberOfPeriods) || 0));
  if (count === 0) return [];

  const start = startOfLocalDay(startDate);
  let end = startOfLocalDay(endDate);
  if (end < start) end = start;

  const periods: ComparisonRange[] = [];

  if (settings.compareType === 'year') {
    for (let i = 1; i <= count; i++) {
      const periodStart = shiftYears(start, i);
      let periodEnd = shiftYears(end, i);
      if (periodEnd < periodStart) periodEnd = periodStart;
      periods.push({ startDate: periodStart, endDate: periodEnd });
    }
  } else if (isCompleteMonth(start, end)) {
    for (let i = 1; i <= count; i++) {
      periods.push(shiftCompleteMonth(start, i));
    }
  } else if (isCompleteQuarter(start, end)) {
    for (let i = 1; i <= count; i++) {
      periods.push(shiftCompleteQuarter(start, i));
    }
  } else {
    const length = Math.max(1, inclusiveDayCount(start, end));
    let cursorEnd = addCalendarDays(start, -1);
    for (let i = 0; i < count; i++) {
      const periodEnd = cursorEnd;
      const periodStart = addCalendarDays(periodEnd, -(length - 1));
      periods.push({ startDate: periodStart, endDate: periodEnd });
      cursorEnd = addCalendarDays(periodStart, -1);
    }
  }

  if (settings.latestToOldest === false) {
    periods.reverse();
  }
  return periods;
}

/** First 10 characters when the value starts with a calendar date. */
export function journalDateKey(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = String(value).match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

export function entryFallsInPeriod(
  entryDate: string | null | undefined,
  startDate: string,
  endDate: string,
): boolean {
  const key = journalDateKey(entryDate);
  if (!key) return false;
  return key >= startDate && key <= endDate;
}

/**
 * Base-currency amount for a report line.
 * A filled base amount is used as stored, including a real zero.
 * A missing base, or a zero base beside a non-zero foreign amount, uses
 * foreign × exchange rate so imported lines are not reported as $0.00.
 */
export function reportLineAmount(
  base: number | null | undefined,
  foreignAmount: number | null | undefined,
  exchangeRate?: number | null,
): number {
  const foreign = Number(foreignAmount ?? 0);
  const safeForeign = Number.isFinite(foreign) ? foreign : 0;
  const rateRaw = Number(exchangeRate ?? 1);
  const rate = Number.isFinite(rateRaw) && rateRaw > 0 ? rateRaw : 1;
  const converted = Math.round(safeForeign * rate * 100) / 100;

  if (base == null) return converted;
  const baseNum = Number(base);
  if (!Number.isFinite(baseNum)) return converted;
  if (baseNum === 0 && safeForeign !== 0) return converted;
  return baseNum;
}
