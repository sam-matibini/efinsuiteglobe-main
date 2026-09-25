// Pure time-clock helpers: hours, breaks and overtime splitting.
// Mirrors the SQL logic in the handle_time_clock_punch_close trigger.

export const DAILY_REGULAR_LIMIT = 8;
export const WEEKLY_REGULAR_LIMIT = 40;

export interface PunchLike {
  id?: string;
  work_date: string;
  clock_in_at: string;
  clock_out_at: string | null;
  break_minutes?: number | null;
  status?: 'open' | 'closed' | string;
  total_hours?: number | null;
  regular_hours?: number | null;
  overtime_hours?: number | null;
}

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Minutes between two ISO timestamps (never negative). */
export function minutesBetween(fromIso: string, toIso: string): number {
  const from = new Date(fromIso).getTime();
  const to = new Date(toIso).getTime();
  if (Number.isNaN(from) || Number.isNaN(to) || to <= from) return 0;
  return Math.floor((to - from) / 60000);
}

/** Worked minutes = clock out - clock in - total break minutes. */
export function workedMinutes(
  clockInAt: string,
  clockOutAt: string,
  breakMinutes = 0,
): number {
  return Math.max(minutesBetween(clockInAt, clockOutAt) - Math.max(breakMinutes, 0), 0);
}

/** Daily split: hours beyond DAILY_REGULAR_LIMIT become overtime. */
export function splitDailyOvertime(totalHours: number): {
  regularHours: number;
  overtimeHours: number;
} {
  const safeTotal = round2(Math.max(totalHours, 0));
  return {
    regularHours: round2(Math.min(safeTotal, DAILY_REGULAR_LIMIT)),
    overtimeHours: round2(Math.max(safeTotal - DAILY_REGULAR_LIMIT, 0)),
  };
}

/** Monday of the Mon-Sun work week containing the given date. */
export function workWeekStart(workDate: string): string {
  const [y, m, d] = workDate.split('-').map(Number);
  const date = new Date(y, (m ?? 1) - 1, d ?? 1);
  const dow = date.getDay(); // 0 = Sunday
  date.setDate(date.getDate() - ((dow + 6) % 7));
  return formatDate(date);
}

export function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Split a week of punches into regular/overtime.
 * Daily OT beyond 8h applies first; once cumulative regular hours pass
 * WEEKLY_REGULAR_LIMIT (Mon-Sun), remaining hours move to overtime so the
 * two rules never double count. Input is sorted by date/clock-in before
 * processing. Returns punches in input order with updated splits.
 */
export function applyWeeklyOvertime<T extends PunchLike>(
  punches: T[],
): Array<T & { regular_hours: number; overtime_hours: number }> {
  const sorted = [...punches].sort(
    (a, b) =>
      a.work_date.localeCompare(b.work_date) ||
      a.clock_in_at.localeCompare(b.clock_in_at),
  );

  let cumulativeRegular = 0;
  const results = new Map<string, { regular_hours: number; overtime_hours: number }>();

  for (const punch of sorted) {
    const total =
      punch.total_hours ??
      (punch.clock_out_at
        ? round2(
            workedMinutes(punch.clock_in_at, punch.clock_out_at, punch.break_minutes ?? 0) / 60,
          )
        : 0);

    const daily = splitDailyOvertime(total);
    let regularHours = daily.regularHours;
    let overtimeHours = daily.overtimeHours;

    if (cumulativeRegular + regularHours > WEEKLY_REGULAR_LIMIT) {
      overtimeHours = round2(overtimeHours + (cumulativeRegular + regularHours - WEEKLY_REGULAR_LIMIT));
      regularHours = round2(Math.max(WEEKLY_REGULAR_LIMIT - cumulativeRegular, 0));
    }
    cumulativeRegular = round2(cumulativeRegular + regularHours);

    if (punch.id) {
      results.set(punch.id, { regular_hours: regularHours, overtime_hours: overtimeHours });
    } else {
      results.set(`${punch.work_date}|${punch.clock_in_at}`, {
        regular_hours: regularHours,
        overtime_hours: overtimeHours,
      });
    }
  }

  return punches.map((punch) => {
    const split = punch.id
      ? results.get(punch.id)
      : results.get(`${punch.work_date}|${punch.clock_in_at}`);
    return split
      ? ({ ...punch, ...split } as T & { regular_hours: number; overtime_hours: number })
      : (punch as T & { regular_hours: number; overtime_hours: number });
  });
}

export interface PeriodSummary {
  totalHours: number;
  regularHours: number;
  overtimeHours: number;
}

/** Totals for a set of punches using the weekly-aware split. */
export function summarizePunches(punches: PunchLike[]): PeriodSummary {
  const closed = punches.filter((p) => p.status === 'closed');
  const open = punches.find((p) => p.status === 'open');

  let regularHours = 0;
  let overtimeHours = 0;
  let totalHours = 0;

  // Weekly cap resets every Mon-Sun work week
  const weeks = new Map<string, PunchLike[]>();
  for (const punch of closed) {
    const key = workWeekStart(punch.work_date);
    const list = weeks.get(key);
    if (list) {
      list.push(punch);
    } else {
      weeks.set(key, [punch]);
    }
  }

  for (const weekPunches of weeks.values()) {
    for (const punch of applyWeeklyOvertime(weekPunches)) {
      const total =
        punch.total_hours ??
        (punch.clock_out_at
          ? round2(
              workedMinutes(punch.clock_in_at, punch.clock_out_at, punch.break_minutes ?? 0) / 60,
            )
          : 0);
      regularHours += punch.regular_hours ?? splitDailyOvertime(total).regularHours;
      overtimeHours += punch.overtime_hours ?? splitDailyOvertime(total).overtimeHours;
      totalHours += total;
    }
  }

  // Live shift counts toward running totals but stays un-split until close
  if (open?.clock_in_at) {
    const end = open.clock_out_at ?? new Date().toISOString();
    totalHours += round2(workedMinutes(open.clock_in_at, end, open.break_minutes ?? 0) / 60);
  }

  return {
    totalHours: round2(totalHours),
    regularHours: round2(regularHours),
    overtimeHours: round2(overtimeHours),
  };
}

export type PayFrequency = 'weekly' | 'bi_weekly' | 'semi_monthly' | 'monthly';

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, (m ?? 1) - 1, d ?? 1);
  date.setDate(date.getDate() + days);
  return formatDate(date);
}

function monthStart(dateStr: string): string {
  return `${dateStr.slice(0, 7)}-01`;
}

function lastDayOfMonth(dateStr: string): string {
  const [y, m] = dateStr.split('-').map(Number);
  return formatDate(new Date(y, m, 0));
}

/**
 * Current pay period containing today, mirroring the DB trigger's rules:
 * weekly = Mon-Sun, bi_weekly = anchored fortnight, semi_monthly = 1-15 /
 * 16-EOM, monthly = calendar month.
 */
export function currentPayPeriod(
  payFrequency: PayFrequency | string | undefined | null,
  onDate = formatDate(new Date()),
): { period_start: string; period_end: string } {
  const monday = workWeekStart(onDate);

  switch (payFrequency) {
    case 'weekly':
      return { period_start: monday, period_end: addDays(monday, 6) };
    case 'bi_weekly': {
      const anchor = '2026-01-05';
      const daysSinceAnchor = Math.round(
        (new Date(`${monday}T00:00:00`).getTime() -
          new Date(`${anchor}T00:00:00`).getTime()) /
          86400000,
      );
      const aligned = ((daysSinceAnchor % 14) + 14) % 14;
      const start = addDays(monday, -aligned);
      return { period_start: start, period_end: addDays(start, 13) };
    }
    case 'semi_monthly': {
      const day = Number(onDate.slice(8, 10));
      if (day <= 15) {
        return { period_start: monthStart(onDate), period_end: `${onDate.slice(0, 7)}-15` };
      }
      return {
        period_start: addDays(monthStart(onDate), 15),
        period_end: lastDayOfMonth(onDate),
      };
    }
    default:
      return { period_start: monthStart(onDate), period_end: lastDayOfMonth(onDate) };
  }
}

/** HH:MM display for an ISO timestamp. */
export function formatTime(iso: string | null | undefined): string {
  if (!iso) return '-';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

/** "1h 23m" style elapsed/total label from minutes. */
export function formatDuration(minutes: number): string {
  const safe = Math.max(Math.floor(minutes), 0);
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}
