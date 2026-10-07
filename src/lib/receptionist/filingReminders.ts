export type GstFilingFrequency = 'monthly' | 'quarterly' | 'annual';
export type CorporationKind = 'ccpc' | 'other';
export type FilingReminderKind =
  | 'gst_hst'
  | 'corporate_balance'
  | 'corporate_return'
  | 'payroll_remittance'
  | 't4_slip'
  | 'saved_deadline';

export interface FilingReminder {
  id: string;
  kind: FilingReminderKind;
  title: string;
  dueDate: string;
  detail: string;
  source: 'calendar' | 'compliance' | 'filing_period';
  overdue: boolean;
}

export interface StoredComplianceDeadline {
  id: string;
  filingType: string;
  dueDate: string;
  extendedDueDate?: string | null;
  status?: string | null;
}

export interface StoredFilingPeriod {
  id: string;
  dueDate: string;
  periodStart: string;
  periodEnd: string;
  status?: string | null;
  notes?: string | null;
}

export interface FilingReminderInput {
  today: string;
  fiscalYearEndMonth?: number | null;
  gstFrequency?: GstFilingFrequency;
  corporationKind?: CorporationKind;
  deadlines?: StoredComplianceDeadline[];
  periods?: StoredFilingPeriod[];
}

const OVERDUE_DAYS = 30;
const HORIZON_DAYS = 400;
const MAX_GST = 4;
const MAX_REMINDERS = 12;

function parseDay(iso: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function formatFilingDate(iso: string): string {
  const date = parseDay(iso);
  if (!date) return iso;
  return new Intl.DateTimeFormat('en-CA', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

function lastDay(year: number, monthIndex: number): Date {
  return new Date(Date.UTC(year, monthIndex + 1, 0));
}

function shiftMonthEnd(year: number, monthIndex: number, add: number): Date {
  const total = year * 12 + monthIndex + add;
  const nextYear = Math.floor(total / 12);
  const nextMonth = ((total % 12) + 12) % 12;
  return lastDay(nextYear, nextMonth);
}

function diffDays(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

function inWindow(today: Date, due: Date): boolean {
  const days = diffDays(today, due);
  return days >= -OVERDUE_DAYS && days <= HORIZON_DAYS;
}

function fiscalMonth(value?: number | null): number {
  if (!value || value < 1 || value > 12) return 12;
  return Math.trunc(value);
}

function isClosed(status?: string | null): boolean {
  return /^(filed|paid|cancelled|canceled|void|completed)$/i.test((status ?? '').trim());
}

function reminder(
  partial: Omit<FilingReminder, 'overdue'> & { today: Date },
): FilingReminder {
  const due = parseDay(partial.dueDate);
  return {
    id: partial.id,
    kind: partial.kind,
    title: partial.title,
    dueDate: partial.dueDate,
    detail: partial.detail,
    source: partial.source,
    overdue: !!due && diffDays(partial.today, due) < 0,
  };
}

function gstItems(today: Date, frequency: GstFilingFrequency, yearEndMonth: number): FilingReminder[] {
  const items: FilingReminder[] = [];
  if (frequency === 'monthly') {
    const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 2, 1));
    for (let offset = 0; offset < 8; offset += 1) {
      const periodEnd = lastDay(start.getUTCFullYear(), start.getUTCMonth() + offset);
      const due = shiftMonthEnd(periodEnd.getUTCFullYear(), periodEnd.getUTCMonth(), 1);
      if (!inWindow(today, due)) continue;
      items.push(reminder({
        today,
        id: `gst-monthly-${formatDay(due)}`,
        kind: 'gst_hst',
        title: 'GST/HST return',
        dueDate: formatDay(due),
        detail: `Monthly GST/HST return and payment for the period ended ${formatFilingDate(formatDay(periodEnd))}. CRA monthly filers file one month after the reporting period ends.`,
        source: 'calendar',
      }));
    }
  } else if (frequency === 'quarterly') {
    const quarterEnds = [2, 5, 8, 11];
    for (let year = today.getUTCFullYear() - 1; year <= today.getUTCFullYear() + 1; year += 1) {
      for (const monthIndex of quarterEnds) {
        const periodEnd = lastDay(year, monthIndex);
        const due = shiftMonthEnd(year, monthIndex, 1);
        if (!inWindow(today, due)) continue;
        items.push(reminder({
          today,
          id: `gst-quarterly-${formatDay(due)}`,
          kind: 'gst_hst',
          title: 'GST/HST return',
          dueDate: formatDay(due),
          detail: `Quarterly GST/HST return and payment for the period ended ${formatFilingDate(formatDay(periodEnd))}. CRA quarterly filers file one month after the quarter ends.`,
          source: 'calendar',
        }));
      }
    }
  } else {
    for (let year = today.getUTCFullYear() - 1; year <= today.getUTCFullYear() + 1; year += 1) {
      const periodEnd = lastDay(year, yearEndMonth - 1);
      const due = shiftMonthEnd(year, yearEndMonth - 1, 3);
      if (!inWindow(today, due)) continue;
      items.push(reminder({
        today,
        id: `gst-annual-${formatDay(due)}`,
        kind: 'gst_hst',
        title: 'GST/HST annual return',
        dueDate: formatDay(due),
        detail: `Annual GST/HST return and payment for the fiscal year ended ${formatFilingDate(formatDay(periodEnd))}. Annual filers generally file within three months of the fiscal year-end.`,
        source: 'calendar',
      }));
    }
  }
  return items
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, MAX_GST);
}

function nextYearEndDue(today: Date, yearEndMonth: number, monthsAfter: number): { due: Date; yearEnd: Date } | null {
  let best: { due: Date; yearEnd: Date } | null = null;
  for (let year = today.getUTCFullYear() - 2; year <= today.getUTCFullYear() + 2; year += 1) {
    const yearEnd = lastDay(year, yearEndMonth - 1);
    const due = shiftMonthEnd(year, yearEndMonth - 1, monthsAfter);
    if (!inWindow(today, due)) continue;
    if (!best || due.getTime() < best.due.getTime()) best = { due, yearEnd };
  }
  return best;
}

function corporateItems(today: Date, yearEndMonth: number, kind: CorporationKind): FilingReminder[] {
  const balanceMonths = kind === 'ccpc' ? 3 : 2;
  const balance = nextYearEndDue(today, yearEndMonth, balanceMonths);
  const filing = nextYearEndDue(today, yearEndMonth, 6);
  const items: FilingReminder[] = [];
  if (balance) {
    items.push(reminder({
      today,
      id: `corporate-balance-${formatDay(balance.due)}`,
      kind: 'corporate_balance',
      title: 'Corporation tax balance',
      dueDate: formatDay(balance.due),
      detail: kind === 'ccpc'
        ? `Balance of corporate tax for the year ended ${formatFilingDate(formatDay(balance.yearEnd))}. A Canadian-controlled private corporation that claimed the small business deduction generally pays three months after the fiscal year-end.`
        : `Balance of corporate tax for the year ended ${formatFilingDate(formatDay(balance.yearEnd))}. Most other corporations pay two months after the fiscal year-end.`,
      source: 'calendar',
    }));
  }
  if (filing) {
    items.push(reminder({
      today,
      id: `corporate-return-${formatDay(filing.due)}`,
      kind: 'corporate_return',
      title: 'T2 corporation income tax return',
      dueDate: formatDay(filing.due),
      detail: `T2 return for the year ended ${formatFilingDate(formatDay(filing.yearEnd))}. The corporation income tax return is due six months after the fiscal year-end.`,
      source: 'calendar',
    }));
  }
  return items;
}

function payrollItem(today: Date): FilingReminder {
  const thisMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 15));
  const due = diffDays(today, thisMonth) >= -7
    ? thisMonth
    : new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 15));
  return reminder({
    today,
    id: `payroll-${formatDay(due)}`,
    kind: 'payroll_remittance',
    title: 'Payroll source deductions',
    dueDate: formatDay(due),
    detail: 'Regular payroll remitters send source deductions by the 15th of the month after they were withheld.',
    source: 'calendar',
  });
}

function t4Item(today: Date): FilingReminder {
  const thisYear = lastDay(today.getUTCFullYear(), 1);
  const due = diffDays(today, thisYear) >= -OVERDUE_DAYS ? thisYear : lastDay(today.getUTCFullYear() + 1, 1);
  return reminder({
    today,
    id: `t4-${formatDay(due)}`,
    kind: 't4_slip',
    title: 'T4 and T4A slips',
    dueDate: formatDay(due),
    detail: 'T4 and T4A information returns are due the last day of February for the previous calendar year.',
    source: 'calendar',
  });
}

function storedItems(today: Date, input: FilingReminderInput): FilingReminder[] {
  const items: FilingReminder[] = [];
  for (const deadline of input.deadlines ?? []) {
    if (isClosed(deadline.status)) continue;
    const dueIso = deadline.extendedDueDate?.trim() || deadline.dueDate;
    const due = parseDay(dueIso);
    if (!due || !inWindow(today, due)) continue;
    const extended = deadline.extendedDueDate?.trim() && deadline.extendedDueDate.trim() !== deadline.dueDate.slice(0, 10);
    items.push(reminder({
      today,
      id: `compliance-${deadline.id}`,
      kind: 'saved_deadline',
      title: deadline.filingType.trim() || 'Saved filing deadline',
      dueDate: formatDay(due),
      detail: extended
        ? `Saved compliance deadline. The extended due date replaces ${formatFilingDate(deadline.dueDate)}.`
        : 'Saved compliance deadline from practice management.',
      source: 'compliance',
    }));
  }
  for (const period of input.periods ?? []) {
    if (isClosed(period.status)) continue;
    const due = parseDay(period.dueDate);
    if (!due || !inWindow(today, due)) continue;
    const notes = period.notes?.trim();
    items.push(reminder({
      today,
      id: `period-${period.id}`,
      kind: 'saved_deadline',
      title: 'Saved tax filing period',
      dueDate: formatDay(due),
      detail: `Filing period ${period.periodStart} to ${period.periodEnd}.${notes ? ` ${notes}` : ''}`,
      source: 'filing_period',
    }));
  }
  return items;
}

function covers(saved: FilingReminder, calendar: FilingReminder): boolean {
  const savedDue = parseDay(saved.dueDate);
  const calendarDue = parseDay(calendar.dueDate);
  if (!savedDue || !calendarDue) return false;
  if (Math.abs(diffDays(savedDue, calendarDue)) > 7) return false;
  const title = saved.title.toLowerCase();
  if (calendar.kind === 'gst_hst') return /gst|hst/.test(title);
  if (calendar.kind === 'corporate_balance' || calendar.kind === 'corporate_return') return /t2|corporat|income tax/.test(title);
  if (calendar.kind === 'payroll_remittance') return /payroll|source deduction|remit/.test(title);
  if (calendar.kind === 't4_slip') return /t4/.test(title);
  return false;
}

export function upcomingFilingReminders(input: FilingReminderInput): FilingReminder[] {
  const today = parseDay(input.today);
  if (!today) return [];
  const yearEndMonth = fiscalMonth(input.fiscalYearEndMonth);
  const frequency = input.gstFrequency ?? 'quarterly';
  const kind = input.corporationKind ?? 'ccpc';
  const saved = storedItems(today, input);
  const calendar = [
    ...gstItems(today, frequency, yearEndMonth),
    ...corporateItems(today, yearEndMonth, kind),
    payrollItem(today),
    t4Item(today),
  ].filter((item) => !saved.some((row) => covers(row, item)));
  return [...saved, ...calendar]
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.title.localeCompare(b.title))
    .slice(0, MAX_REMINDERS);
}

export function reminderMessage(organizationName: string, item: FilingReminder): { subject: string; body: string } {
  const due = formatFilingDate(item.dueDate);
  const name = organizationName.trim() || 'Your organization';
  return {
    subject: `${item.title} due ${due}`,
    body: `${name}: ${item.title} is due ${due}. ${item.detail}`,
  };
}
