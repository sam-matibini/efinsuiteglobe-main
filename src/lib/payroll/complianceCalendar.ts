// Turns a country's ComplianceDeadline rules into due dates for one payroll / tax month.
import type { ComplianceDeadline } from '@/data/payrollLocalization';

export interface CalendarEntry {
  id: string;
  activity: string;
  authority: string;
  /** YYYY-MM-DD, or null when the scheme sets the date (see note). */
  dueDate: string | null;
  /** Due date is a Saturday, Sunday or listed holiday: plan to pay on the working day before. */
  onNonWorkingDay: boolean;
  /** When the date depends on input that was not given (e.g. salary payment date). */
  missingInput?: string;
  note?: string;
  legalBasis: string;
  confirmWithAuthority: boolean;
}

export interface CalendarOptions {
  /** Payroll / tax month, 'YYYY-MM'. */
  month: string;
  /** Date salaries were paid ('YYYY-MM-DD'); needed for pension. */
  salaryPaymentDate?: string;
  /** Public holidays ('YYYY-MM-DD') to skip when counting working days. */
  holidays?: string[];
  /** Include annual items (ITF, annual PAYE return) falling due in the following month. Default true. */
  includeAnnual?: boolean;
}

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const utc = (y: number, m0: number, d: number) => new Date(Date.UTC(y, m0, d));
const lastDay = (y: number, m0: number) => utc(y, m0 + 1, 0).getUTCDate();

function isNonWorking(d: Date, holidays: Set<string>): boolean {
  const wd = d.getUTCDay();
  return wd === 0 || wd === 6 || holidays.has(iso(d));
}

/** Adds N working days (skipping weekends and holidays) after a date. */
export function addWorkingDays(start: string, days: number, holidays: string[] = []): string {
  const hs = new Set(holidays);
  const [y, m, d] = start.split('-').map(Number);
  const cur = utc(y, m - 1, d);
  let added = 0;
  while (added < days) {
    cur.setUTCDate(cur.getUTCDate() + 1);
    if (!isNonWorking(cur, hs)) added++;
  }
  return iso(cur);
}

/** Due dates for obligations arising from payroll / tax month `opts.month`. */
export function buildComplianceCalendar(deadlines: ComplianceDeadline[], opts: CalendarOptions): CalendarEntry[] {
  const [y, m] = opts.month.split('-').map(Number);
  if (!y || !m) throw new Error(`Invalid month "${opts.month}" (expected YYYY-MM)`);
  const m0 = m - 1;
  const nextY = m0 === 11 ? y + 1 : y;
  const nextM0 = (m0 + 1) % 12;
  const hs = new Set(opts.holidays ?? []);
  const out: CalendarEntry[] = [];

  for (const dl of deadlines) {
    let due: Date | null = null;
    let missingInput: string | undefined;
    const r = dl.rule;
    switch (r.kind) {
      case 'day_of_following_month':
        due = utc(nextY, nextM0, Math.min(r.day, lastDay(nextY, nextM0)));
        break;
      case 'within_one_month_of_deduction':
        // Deducted at month-end payroll → due one month later (end of the following month).
        due = utc(nextY, nextM0, lastDay(nextY, nextM0));
        break;
      case 'month_end':
        due = utc(y, m0, lastDay(y, m0));
        break;
      case 'working_days_after_salary':
        if (opts.salaryPaymentDate) {
          const d = addWorkingDays(opts.salaryPaymentDate, r.days, opts.holidays);
          const [dy, dm, dd] = d.split('-').map(Number);
          due = utc(dy, dm - 1, dd);
        } else {
          missingInput = 'Enter the salary payment date to calculate this deadline.';
        }
        break;
      case 'annual':
        if (opts.includeAnnual === false) continue;
        // Show annual items only in the month before they fall due.
        if (r.month - 1 !== nextM0) continue;
        due = utc(nextY, r.month - 1, Math.min(r.day, lastDay(nextY, r.month - 1)));
        break;
      case 'scheme_specific':
        due = null;
        break;
    }
    out.push({
      id: dl.id,
      activity: dl.activity,
      authority: dl.authority,
      dueDate: due ? iso(due) : null,
      onNonWorkingDay: due ? isNonWorking(due, hs) : false,
      missingInput,
      note: dl.note,
      legalBasis: dl.legalBasis,
      confirmWithAuthority: !!dl.confirmWithAuthority,
    });
  }
  // Dated items in date order; undated (scheme-specific / missing input) last.
  return out.sort((a, b) => (a.dueDate && b.dueDate ? a.dueDate.localeCompare(b.dueDate) : a.dueDate ? -1 : b.dueDate ? 1 : 0));
}

export type DueStatus = 'overdue' | 'due_soon' | 'upcoming' | 'no_date';
/** Status relative to `today` (YYYY-MM-DD); "due soon" = within 5 days. */
export function dueStatus(dueDate: string | null, today: string): DueStatus {
  if (!dueDate) return 'no_date';
  if (dueDate < today) return 'overdue';
  const diff = (Date.parse(dueDate) - Date.parse(today)) / 86_400_000;
  return diff <= 5 ? 'due_soon' : 'upcoming';
}
