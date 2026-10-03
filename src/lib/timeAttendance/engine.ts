import { workWeekStart } from '../timeClock';
import {
  DEFAULT_WEEKDAY_SCHEDULE,
  WEEKDAYS,
  type Actor,
  type AttendanceRole,
  type AttendanceStatus,
  type AuditEvent,
  type BreakMode,
  type ClockOutReceipt,
  type CompanyTimeSettings,
  type DaySchedule,
  type EmployeeTimeSettings,
  type OrgAttendance,
  type PayType,
  type PayrollTimeSummary,
  type TimeAdjustment,
  type TimeEntry,
  type TimeSource,
  type Weekday,
} from './types';

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function createId(_prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const value = Math.floor(Math.random() * 16);
    const digit = char === 'x' ? value : (value & 0x3) | 0x8;
    return digit.toString(16);
  });
}

export function defaultOvertimePolicy() {
  return { dailyRegularLimit: 8, weeklyRegularLimit: 40, overtimeMultiplier: 1.5 };
}

export function defaultCompanySettings(organizationId: string): CompanyTimeSettings {
  return {
    organizationId,
    enabled: false,
    clockInOutEnabled: true,
    payrollIntegration: true,
    managerApprovalRequired: true,
    overtimeEnabled: true,
    breakTrackingEnabled: true,
    breakMode: 'unpaid',
    autoBreakMinutes: 30,
    timezone: 'America/Toronto',
    allowUnresolvedPayroll: false,
    overtimePolicy: defaultOvertimePolicy(),
  };
}

export function emptyOrg(organizationId: string): OrgAttendance {
  return {
    company: defaultCompanySettings(organizationId),
    employees: {},
    entries: [],
    adjustments: [],
    approvals: [],
    summaries: [],
    audit: [],
  };
}

export function inferPayType(employee: {
  annual_salary?: number | null;
  hourly_rate?: number | null;
}): PayType {
  if (employee.annual_salary && employee.annual_salary > 0 && !(employee.hourly_rate && employee.hourly_rate > 0)) {
    return 'salary';
  }
  if (employee.hourly_rate && employee.hourly_rate > 0 && !(employee.annual_salary && employee.annual_salary > 0)) {
    return 'hourly';
  }
  if (employee.annual_salary && employee.annual_salary > 0) return 'salary';
  return 'hourly';
}

export function defaultEmployeeSettings(
  company: CompanyTimeSettings,
  employeeId: string,
  payType: PayType,
): EmployeeTimeSettings {
  return {
    organizationId: company.organizationId,
    employeeId,
    enabled: null,
    clockInRequired: true,
    clockOutRequired: true,
    schedule: DEFAULT_WEEKDAY_SCHEDULE.map((day) => ({ ...day })),
    breakMinutes: company.autoBreakMinutes,
    overtimeRule: 'company_default',
    payType,
  };
}

/** Company off hides clocking for everyone. Salary inherits off. Hourly inherits the company switch. */
export function resolveTracking(
  company: CompanyTimeSettings,
  settings: EmployeeTimeSettings | null | undefined,
  payType: PayType,
): boolean {
  if (!company.enabled || !company.clockInOutEnabled) return false;
  if (settings?.enabled === true) return true;
  if (settings?.enabled === false) return false;
  return payType === 'hourly';
}

function safeTimeZone(timeZone: string): string {
  try {
    Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date());
    return timeZone;
  } catch {
    return 'America/Toronto';
  }
}

export function calendarDate(iso: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: safeTimeZone(timeZone),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function formatClock(iso: string | null, timeZone: string): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: safeTimeZone(timeZone),
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(iso));
}

export function formatLongDate(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: safeTimeZone(timeZone),
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(new Date(iso));
}

export function formatElapsed(minutes: number): string {
  const safe = Math.max(Math.floor(minutes), 0);
  const hours = Math.floor(safe / 60);
  const mins = safe % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

export function weekdayOf(dateStr: string): Weekday {
  const [year, month, day] = dateStr.split('-').map(Number);
  return WEEKDAYS[new Date(year, (month ?? 1) - 1, day ?? 1).getDay()];
}

export function scheduleLabel(schedule: DaySchedule[] | undefined, workDate: string): string {
  const day = weekdayOf(workDate);
  const row = (schedule ?? DEFAULT_WEEKDAY_SCHEDULE).find((item) => item.day === day);
  if (!row) return 'Not scheduled';
  return `${formatWall(row.start)} – ${formatWall(row.end)}`;
}

function formatWall(hhmm: string): string {
  const [hourRaw, minuteRaw] = hhmm.split(':');
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw ?? '0');
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${String(minute).padStart(2, '0')} ${suffix}`;
}

const LOCKED: AttendanceStatus[] = ['LOCKED', 'EXPORTED_TO_PAYROLL'];

function audit(
  org: OrgAttendance,
  actor: Actor,
  action: string,
  entityId: string,
  detail: string,
  at: string,
): OrgAttendance {
  const event: AuditEvent = {
    id: createId('aud'),
    at,
    actorId: actor.userId,
    role: actor.role,
    action,
    entityId,
    detail,
  };
  return { ...org, audit: [...org.audit, event] };
}

export function canClock(actor: Actor, employeeId: string): boolean {
  if (actor.role === 'accountant') return false;
  if (actor.role === 'employee') return actor.employeeId === employeeId;
  return true;
}

export function canView(actor: Actor, employeeId: string): boolean {
  if (actor.role === 'employee') return actor.employeeId === employeeId;
  if (actor.role === 'manager') {
    return actor.employeeId === employeeId || (actor.teamEmployeeIds ?? []).includes(employeeId);
  }
  return true;
}

export function canAdjust(actor: Actor): boolean {
  return actor.role === 'manager' || actor.role === 'hr' || actor.role === 'payroll_admin' || actor.role === 'company_admin';
}

export function canApprove(actor: Actor, entry: TimeEntry): boolean {
  if (actor.role === 'employee' || actor.role === 'accountant') return false;
  if (actor.employeeId && actor.employeeId === entry.employeeId) return false;
  return actor.role === 'manager' || actor.role === 'hr' || actor.role === 'payroll_admin' || actor.role === 'company_admin';
}

export function permissionMatrix(): Record<AttendanceRole, { clock: string; view: string; adjust: string; approve: string }> {
  return {
    employee: { clock: 'Own', view: 'Own', adjust: 'Request', approve: 'No' },
    manager: { clock: 'Optional', view: 'Team', adjust: 'Yes', approve: 'Yes' },
    hr: { clock: 'Optional', view: 'All', adjust: 'Yes', approve: 'Yes' },
    payroll_admin: { clock: 'Optional', view: 'All', adjust: 'Yes', approve: 'Yes' },
    company_admin: { clock: 'Optional', view: 'All', adjust: 'Yes', approve: 'Yes' },
    accountant: { clock: 'No', view: 'Payroll reports', adjust: 'Limited', approve: 'No' },
  };
}

function openEntry(org: OrgAttendance, employeeId: string): TimeEntry | undefined {
  return org.entries.find((entry) => entry.employeeId === employeeId && entry.status === 'OPEN');
}

function employeeSettings(
  org: OrgAttendance,
  employeeId: string,
  payType: PayType,
): EmployeeTimeSettings {
  return org.employees[employeeId] ?? defaultEmployeeSettings(org.company, employeeId, payType);
}

export function configureCompany(
  org: OrgAttendance,
  patch: Partial<CompanyTimeSettings>,
  actor: Actor,
  at: string,
): { org: OrgAttendance; error?: string } {
  if (actor.role === 'employee' || actor.role === 'accountant') {
    return { org, error: 'You cannot change company time settings.' };
  }
  const company = { ...org.company, ...patch, organizationId: org.company.organizationId };
  if (patch.overtimePolicy) {
    company.overtimePolicy = { ...org.company.overtimePolicy, ...patch.overtimePolicy };
  }
  return {
    org: audit({ ...org, company }, actor, 'company_settings', org.company.organizationId, company.enabled ? 'Time tracking enabled' : 'Time tracking updated', at),
  };
}

export function configureEmployee(
  org: OrgAttendance,
  settings: EmployeeTimeSettings,
  actor: Actor,
  at: string,
): { org: OrgAttendance; error?: string } {
  if (!canAdjust(actor) && actor.role !== 'company_admin') {
    return { org, error: 'You cannot change employee time settings.' };
  }
  return {
    org: audit(
      { ...org, employees: { ...org.employees, [settings.employeeId]: settings } },
      actor,
      'employee_settings',
      settings.employeeId,
      settings.enabled === false ? 'Time tracking disabled' : 'Time tracking updated',
      at,
    ),
  };
}

export function clockIn(
  org: OrgAttendance,
  input: {
    employeeId: string;
    employeeName?: string;
    department?: string | null;
    payType: PayType;
    at: string;
    source: TimeSource;
    actor: Actor;
    notes?: string;
  },
): { org: OrgAttendance; entry?: TimeEntry; error?: string } {
  if (!canClock(input.actor, input.employeeId)) {
    return { org, error: 'You cannot clock in for this employee.' };
  }
  const settings = employeeSettings(org, input.employeeId, input.payType);
  if (!resolveTracking(org.company, settings, input.payType)) {
    return { org, error: 'Time tracking is not enabled for this employee.' };
  }
  const existing = openEntry(org, input.employeeId);
  if (existing) {
    return { org, error: `You are already clocked in at ${formatClock(existing.clockIn, existing.timezone)}.` };
  }
  const timezone = org.company.timezone;
  const entry: TimeEntry = {
    id: createId('att'),
    organizationId: org.company.organizationId,
    employeeId: input.employeeId,
    employeeName: input.employeeName,
    department: input.department,
    workDate: calendarDate(input.at, timezone),
    clockIn: input.at,
    clockOut: null,
    timezone,
    breakMinutes: 0,
    grossHours: 0,
    paidHours: 0,
    regularHours: 0,
    overtimeHours: 0,
    holidayHours: 0,
    vacationHours: 0,
    sickHours: 0,
    status: 'OPEN',
    source: input.source,
    notes: input.notes ?? null,
    breaks: [],
    originalClockIn: null,
    originalClockOut: null,
    createdAt: input.at,
    updatedAt: input.at,
  };
  return {
    org: audit({ ...org, entries: [...org.entries, entry] }, input.actor, 'clock_in', entry.id, 'Clock in', input.at),
    entry,
  };
}

export function startBreak(
  org: OrgAttendance,
  input: { employeeId: string; at: string; actor: Actor },
): { org: OrgAttendance; error?: string } {
  if (!org.company.breakTrackingEnabled || org.company.breakMode === 'automatic') {
    return { org, error: 'Manual breaks are not enabled.' };
  }
  const entry = openEntry(org, input.employeeId);
  if (!entry) return { org, error: 'No active clock-in was found.' };
  if (!canClock(input.actor, input.employeeId)) return { org, error: 'You cannot start a break for this employee.' };
  if (entry.breaks.some((span) => !span.end)) return { org, error: 'A break is already in progress.' };
  const next: TimeEntry = {
    ...entry,
    breaks: [...entry.breaks, { id: createId('brk'), start: input.at, end: null, minutes: 0 }],
    updatedAt: input.at,
  };
  return { org: replaceEntry(audit({ ...org }, input.actor, 'break_start', entry.id, 'Break started', input.at), next) };
}

export function endBreak(
  org: OrgAttendance,
  input: { employeeId: string; at: string; actor: Actor },
): { org: OrgAttendance; error?: string } {
  const entry = openEntry(org, input.employeeId);
  if (!entry) return { org, error: 'No active clock-in was found.' };
  const span = entry.breaks.find((item) => !item.end);
  if (!span) return { org, error: 'No break is in progress.' };
  const minutes = Math.max(0, Math.round((new Date(input.at).getTime() - new Date(span.start).getTime()) / 60000));
  const breaks = entry.breaks.map((item) => (item.id === span.id ? { ...item, end: input.at, minutes } : item));
  const next: TimeEntry = {
    ...entry,
    breaks,
    breakMinutes: breaks.reduce((sum, item) => sum + item.minutes, 0),
    updatedAt: input.at,
  };
  return { org: replaceEntry(audit(org, input.actor, 'break_end', entry.id, 'Break ended', input.at), next) };
}

export function clockOut(
  org: OrgAttendance,
  input: { employeeId: string; payType: PayType; at: string; actor: Actor; notes?: string },
): { org: OrgAttendance; entry?: TimeEntry; receipt?: ClockOutReceipt; error?: string } {
  const entry = openEntry(org, input.employeeId);
  if (!entry) return { org, error: 'No active clock-in was found.' };
  if (!canClock(input.actor, input.employeeId)) return { org, error: 'You cannot clock out for this employee.' };
  let working = org;
  if (entry.breaks.some((span) => !span.end)) {
    const ended = endBreak(working, input);
    if (ended.error || !ended.org) return { org, error: ended.error };
    working = ended.org;
  }
  const current = working.entries.find((item) => item.id === entry.id)!;
  const settings = employeeSettings(working, input.employeeId, input.payType);
  const closed = closeEntry(current, input.at, working.company, settings, input.notes);
  working = replaceEntry(working, closed);
  working = allocateHours(working, input.employeeId);
  const saved = working.entries.find((item) => item.id === entry.id)!;
  const receipt: ClockOutReceipt = {
    clockIn: formatClock(saved.clockIn, saved.timezone),
    clockOut: formatClock(saved.clockOut, saved.timezone),
    breakMinutes: saved.breakMinutes,
    grossHours: saved.grossHours,
    paidHours: saved.paidHours,
    regularHours: saved.regularHours,
    overtimeHours: saved.overtimeHours,
  };
  return {
    org: audit(working, input.actor, 'clock_out', saved.id, `Paid ${saved.paidHours} hours`, input.at),
    entry: saved,
    receipt,
  };
}

function closeEntry(
  entry: TimeEntry,
  at: string,
  company: CompanyTimeSettings,
  settings: EmployeeTimeSettings,
  notes?: string,
): TimeEntry {
  let breakMinutes = entry.breakMinutes;
  if (company.breakMode === 'automatic' && breakMinutes === 0) {
    breakMinutes = settings.breakMinutes || company.autoBreakMinutes;
  }
  const grossHours = round2(Math.max(new Date(at).getTime() - new Date(entry.clockIn).getTime(), 0) / 3600000);
  const unpaid = company.breakMode === 'paid' ? 0 : breakMinutes;
  const paidHours = round2(Math.max(grossHours - unpaid / 60, 0));
  const status: AttendanceStatus = company.managerApprovalRequired ? 'PENDING_APPROVAL' : 'APPROVED';
  return {
    ...entry,
    clockOut: at,
    breakMinutes,
    grossHours,
    paidHours,
    status,
    notes: notes?.trim() ? notes.trim() : entry.notes,
    updatedAt: at,
  };
}

function replaceEntry(org: OrgAttendance, entry: TimeEntry): OrgAttendance {
  return { ...org, entries: org.entries.map((item) => (item.id === entry.id ? entry : item)) };
}

function allocateHours(org: OrgAttendance, employeeId: string): OrgAttendance {
  const settings = org.employees[employeeId];
  const overtimeOn = org.company.overtimeEnabled && settings?.overtimeRule !== 'none';
  const dailyLimit = overtimeOn ? org.company.overtimePolicy.dailyRegularLimit : Number.POSITIVE_INFINITY;
  const weeklyLimit = overtimeOn ? org.company.overtimePolicy.weeklyRegularLimit : Number.POSITIVE_INFINITY;
  const mine = org.entries.filter((entry) => entry.employeeId === employeeId && entry.clockOut && !LOCKED.includes(entry.status) && entry.status !== 'REJECTED');
  const weeks = new Map<string, TimeEntry[]>();
  for (const entry of mine) {
    const key = workWeekStart(entry.workDate);
    weeks.set(key, [...(weeks.get(key) ?? []), entry]);
  }
  const updates = new Map<string, TimeEntry>();
  for (const week of weeks.values()) {
    const sorted = [...week].sort((a, b) => a.clockIn.localeCompare(b.clockIn));
    let cumulative = 0;
    for (const entry of sorted) {
      const dailyRegular = round2(Math.min(entry.paidHours, dailyLimit));
      let regular = dailyRegular;
      let overtime = round2(Math.max(entry.paidHours - dailyRegular, 0));
      if (cumulative + regular > weeklyLimit) {
        overtime = round2(overtime + (cumulative + regular - weeklyLimit));
        regular = round2(Math.max(weeklyLimit - cumulative, 0));
      }
      cumulative = round2(cumulative + regular);
      updates.set(entry.id, { ...entry, regularHours: regular, overtimeHours: overtime });
    }
  }
  return {
    ...org,
    entries: org.entries.map((entry) => updates.get(entry.id) ?? entry),
  };
}

export function approveEntry(
  org: OrgAttendance,
  input: { entryId: string; actor: Actor; at: string; comments?: string },
): { org: OrgAttendance; error?: string } {
  const entry = org.entries.find((item) => item.id === input.entryId);
  if (!entry) return { org, error: 'Time record was not found.' };
  if (!canApprove(input.actor, entry)) return { org, error: 'You cannot approve this time record.' };
  if (entry.status === 'OPEN') return { org, error: 'Clock out before approving hours.' };
  if (LOCKED.includes(entry.status)) return { org, error: 'This time record is already locked for payroll.' };
  const next = { ...entry, status: 'APPROVED' as const, updatedAt: input.at };
  const withEntry = replaceEntry(org, next);
  return {
    org: audit(
      {
        ...withEntry,
        approvals: [
          ...withEntry.approvals,
          {
            id: createId('appr'),
            timeEntryId: entry.id,
            approverId: input.actor.userId,
            status: 'APPROVED',
            comments: input.comments ?? null,
            approvedAt: input.at,
          },
        ],
      },
      input.actor,
      'approve',
      entry.id,
      'Approved',
      input.at,
    ),
  };
}

export function rejectEntry(
  org: OrgAttendance,
  input: { entryId: string; actor: Actor; at: string; comments?: string },
): { org: OrgAttendance; error?: string } {
  const entry = org.entries.find((item) => item.id === input.entryId);
  if (!entry) return { org, error: 'Time record was not found.' };
  if (!canApprove(input.actor, entry)) return { org, error: 'You cannot reject this time record.' };
  const next = { ...entry, status: 'REJECTED' as const, updatedAt: input.at };
  return {
    org: audit(
      {
        ...replaceEntry(org, next),
        approvals: [
          ...org.approvals,
          {
            id: createId('appr'),
            timeEntryId: entry.id,
            approverId: input.actor.userId,
            status: 'REJECTED',
            comments: input.comments ?? null,
            approvedAt: input.at,
          },
        ],
      },
      input.actor,
      'reject',
      entry.id,
      input.comments ?? 'Rejected',
      input.at,
    ),
  };
}

export function requestCorrection(
  org: OrgAttendance,
  input: { entryId: string; actor: Actor; at: string; reason: string },
): { org: OrgAttendance; error?: string } {
  const entry = org.entries.find((item) => item.id === input.entryId);
  if (!entry) return { org, error: 'Time record was not found.' };
  if (input.actor.role === 'employee' && input.actor.employeeId !== entry.employeeId) {
    return { org, error: 'You can only request a correction for your own time.' };
  }
  if (LOCKED.includes(entry.status)) return { org, error: 'Payroll has already locked this time record.' };
  const adjustment: TimeAdjustment = {
    id: createId('adj'),
    timeEntryId: entry.id,
    fieldName: 'correction_request',
    originalValue: entry.status,
    newValue: 'PENDING_APPROVAL',
    reason: input.reason,
    adjustedBy: input.actor.userId,
    adjustedAt: input.at,
  };
  const next = { ...entry, status: 'PENDING_APPROVAL' as const, updatedAt: input.at };
  return {
    org: audit(
      { ...replaceEntry(org, next), adjustments: [...org.adjustments, adjustment] },
      input.actor,
      'request_correction',
      entry.id,
      input.reason,
      input.at,
    ),
  };
}

export function adjustEntry(
  org: OrgAttendance,
  input: {
    entryId: string;
    actor: Actor;
    at: string;
    reason: string;
    clockIn?: string;
    clockOut?: string;
    holidayHours?: number;
    vacationHours?: number;
    sickHours?: number;
    payType?: PayType;
  },
): { org: OrgAttendance; error?: string } {
  const entry = org.entries.find((item) => item.id === input.entryId);
  if (!entry) return { org, error: 'Time record was not found.' };
  if (input.actor.role === 'employee') return { org, error: 'Ask a manager to adjust these hours.' };
  if (!canAdjust(input.actor)) return { org, error: 'You cannot adjust time records.' };
  if (LOCKED.includes(entry.status)) return { org, error: 'Payroll has already locked this time record.' };
  if (!input.reason.trim()) return { org, error: 'A reason is required.' };
  const adjustments: TimeAdjustment[] = [];
  const push = (fieldName: string, originalValue: string, newValue: string) => {
    if (originalValue === newValue) return;
    adjustments.push({
      id: createId('adj'),
      timeEntryId: entry.id,
      fieldName,
      originalValue,
      newValue,
      reason: input.reason,
      adjustedBy: input.actor.userId,
      adjustedAt: input.at,
    });
  };
  let next: TimeEntry = {
    ...entry,
    originalClockIn: entry.originalClockIn ?? entry.clockIn,
    originalClockOut: entry.originalClockOut ?? entry.clockOut,
    updatedAt: input.at,
    status: 'ADJUSTED',
  };
  if (input.clockIn) {
    push('clock_in', entry.clockIn, input.clockIn);
    next = { ...next, clockIn: input.clockIn, workDate: calendarDate(input.clockIn, entry.timezone) };
  }
  if (input.clockOut) {
    push('clock_out', entry.clockOut ?? '', input.clockOut);
    next = { ...next, clockOut: input.clockOut };
  }
  if (input.holidayHours != null) {
    push('holiday_hours', String(entry.holidayHours), String(input.holidayHours));
    next = { ...next, holidayHours: round2(input.holidayHours) };
  }
  if (input.vacationHours != null) {
    push('vacation_hours', String(entry.vacationHours), String(input.vacationHours));
    next = { ...next, vacationHours: round2(input.vacationHours) };
  }
  if (input.sickHours != null) {
    push('sick_hours', String(entry.sickHours), String(input.sickHours));
    next = { ...next, sickHours: round2(input.sickHours) };
  }
  if (next.clockOut) {
    const settings = employeeSettings(org, entry.employeeId, input.payType ?? 'hourly');
    const grossHours = round2(Math.max(new Date(next.clockOut).getTime() - new Date(next.clockIn).getTime(), 0) / 3600000);
    const unpaid = org.company.breakMode === 'paid' ? 0 : next.breakMinutes;
    next = { ...next, grossHours, paidHours: round2(Math.max(grossHours - unpaid / 60, 0)) };
  }
  let updated = replaceEntry({ ...org, adjustments: [...org.adjustments, ...adjustments] }, next);
  updated = allocateHours(updated, entry.employeeId);
  if (org.company.managerApprovalRequired) {
    const refreshed = updated.entries.find((item) => item.id === entry.id)!;
    updated = replaceEntry(updated, { ...refreshed, status: 'PENDING_APPROVAL' });
  } else {
    const refreshed = updated.entries.find((item) => item.id === entry.id)!;
    updated = replaceEntry(updated, { ...refreshed, status: 'ADJUSTED' });
  }
  return { org: audit(updated, input.actor, 'adjust', entry.id, input.reason, input.at) };
}

const PAYROLL_READY: AttendanceStatus[] = ['APPROVED', 'ADJUSTED', 'LOCKED', 'EXPORTED_TO_PAYROLL'];

export function approvedEntries(org: OrgAttendance, periodStart: string, periodEnd: string, employeeId?: string): TimeEntry[] {
  if (!org.company.enabled || !org.company.payrollIntegration) return [];
  return org.entries.filter((entry) => {
    if (employeeId && entry.employeeId !== employeeId) return false;
    if (entry.workDate < periodStart || entry.workDate > periodEnd) return false;
    if (!PAYROLL_READY.includes(entry.status)) return false;
    if (org.company.managerApprovalRequired && entry.status === 'ADJUSTED') return false;
    return true;
  });
}

export function summarizeEmployee(
  org: OrgAttendance,
  employeeId: string,
  periodStart: string,
  periodEnd: string,
): Omit<PayrollTimeSummary, 'id' | 'payrollRunId' | 'createdAt'> {
  const rows = approvedEntries(org, periodStart, periodEnd, employeeId);
  const daily = rows.map((entry) => ({
    workDate: entry.workDate,
    entryId: entry.id,
    regularHours: entry.regularHours,
    overtimeHours: entry.overtimeHours,
    holidayHours: entry.holidayHours,
  }));
  const regularHours = round2(rows.reduce((sum, entry) => sum + entry.regularHours, 0));
  const overtimeHours = round2(rows.reduce((sum, entry) => sum + entry.overtimeHours, 0));
  const holidayHours = round2(rows.reduce((sum, entry) => sum + entry.holidayHours, 0));
  const vacationHours = round2(rows.reduce((sum, entry) => sum + entry.vacationHours, 0));
  const sickHours = round2(rows.reduce((sum, entry) => sum + entry.sickHours, 0));
  return {
    employeeId,
    regularHours,
    overtimeHours,
    holidayHours,
    vacationHours,
    sickHours,
    totalHours: round2(regularHours + overtimeHours + holidayHours + vacationHours + sickHours),
    entryIds: rows.map((entry) => entry.id),
    daily,
  };
}

export function earningsFromSummary(
  summary: Pick<PayrollTimeSummary, 'regularHours' | 'overtimeHours' | 'holidayHours'>,
  hourlyRate: number,
  policy: { overtimeMultiplier: number },
) {
  const regularEarnings = round2(summary.regularHours * hourlyRate);
  const overtimeEarnings = round2(summary.overtimeHours * hourlyRate * policy.overtimeMultiplier);
  const holidayEarnings = round2(summary.holidayHours * hourlyRate);
  return {
    regularEarnings,
    overtimeEarnings,
    holidayEarnings,
    grossEarnings: round2(regularEarnings + overtimeEarnings + holidayEarnings),
  };
}

export interface PayrollReadiness {
  enabled: boolean;
  employeesUsingTimeTracking: number;
  completedTimesheets: number;
  pendingApproval: number;
  missingClockOut: number;
  approvedHours: number;
  canFinalize: boolean;
  warning: string | null;
}

export function payrollReadiness(
  org: OrgAttendance,
  input: {
    periodStart: string;
    periodEnd: string;
    employees: Array<{ id: string; payType: PayType }>;
    today: string;
  },
): PayrollReadiness {
  if (!org.company.enabled) {
    return {
      enabled: false,
      employeesUsingTimeTracking: 0,
      completedTimesheets: 0,
      pendingApproval: 0,
      missingClockOut: 0,
      approvedHours: 0,
      canFinalize: true,
      warning: null,
    };
  }
  const tracked = input.employees.filter((employee) =>
    resolveTracking(org.company, org.employees[employee.id], employee.payType),
  );
  let pending = 0;
  let missing = 0;
  let completed = 0;
  let approvedHours = 0;
  for (const employee of tracked) {
    const rows = org.entries.filter(
      (entry) => entry.employeeId === employee.id && entry.workDate >= input.periodStart && entry.workDate <= input.periodEnd,
    );
    const settings = org.employees[employee.id];
    const clockOutRequired = settings?.clockOutRequired !== false;
    const employeePending = rows.filter((entry) => entry.status === 'PENDING_APPROVAL' || entry.status === 'OPEN').length;
    const employeeMissing = rows.filter((entry) => entry.status === 'OPEN' && clockOutRequired && entry.workDate < input.today).length;
    if (employeePending > 0 || employeeMissing > 0) pending += employeePending > 0 ? 1 : 0;
    if (employeeMissing > 0) missing += 1;
    if (rows.length > 0 && employeePending === 0 && employeeMissing === 0) completed += 1;
    approvedHours += summarizeEmployee(org, employee.id, input.periodStart, input.periodEnd).totalHours;
  }
  const unresolved = pending + missing;
  const canFinalize = org.company.allowUnresolvedPayroll || unresolved === 0;
  return {
    enabled: true,
    employeesUsingTimeTracking: tracked.length,
    completedTimesheets: completed,
    pendingApproval: pending,
    missingClockOut: missing,
    approvedHours: round2(approvedHours),
    canFinalize,
    warning: unresolved > 0 ? `${unresolved} employees have unapproved hours.` : null,
  };
}

export function exportToPayroll(
  org: OrgAttendance,
  input: {
    payrollRunId: string;
    periodStart: string;
    periodEnd: string;
    employeeIds: string[];
    at: string;
    actor: Actor;
  },
): { org: OrgAttendance; summaries: PayrollTimeSummary[]; error?: string } {
  if (!org.company.enabled || !org.company.payrollIntegration) {
    return { org, summaries: [] };
  }
  if (!canAdjust(input.actor) && input.actor.role !== 'company_admin') {
    return { org, summaries: [], error: 'You cannot send time to payroll.' };
  }
  const summaries: PayrollTimeSummary[] = [];
  let next = org;
  for (const employeeId of input.employeeIds) {
    const summary = summarizeEmployee(next, employeeId, input.periodStart, input.periodEnd);
    if (summary.entryIds.length === 0) continue;
    const row: PayrollTimeSummary = {
      ...summary,
      id: createId('pts'),
      payrollRunId: input.payrollRunId,
      createdAt: input.at,
    };
    summaries.push(row);
    next = {
      ...next,
      entries: next.entries.map((entry) =>
        summary.entryIds.includes(entry.id) ? { ...entry, status: 'EXPORTED_TO_PAYROLL', updatedAt: input.at } : entry,
      ),
      summaries: [...next.summaries, row],
    };
    next = audit(next, input.actor, 'export_payroll', row.id, `${summary.totalHours} hours`, input.at);
  }
  return { org: next, summaries };
}

export interface TimesheetHours {
  employeeId: string;
  regularHours: number;
  overtimeHours: number;
  vacationHours: number;
  sickHours: number;
  holidayHours?: number;
  attendanceLocked?: boolean;
  attendanceEntryIds?: string[];
}

export function overlayApprovedHours<T extends TimesheetHours>(
  timesheets: T[],
  org: OrgAttendance,
  periodStart: string,
  periodEnd: string,
  employees: Array<{ id: string; payType: PayType }>,
): T[] {
  if (!org.company.enabled || !org.company.payrollIntegration) return timesheets;
  return timesheets.map((sheet) => {
    const employee = employees.find((item) => item.id === sheet.employeeId);
    if (!employee) return sheet;
    if (!resolveTracking(org.company, org.employees[employee.id], employee.payType)) return sheet;
    const summary = summarizeEmployee(org, employee.id, periodStart, periodEnd);
    return {
      ...sheet,
      regularHours: summary.regularHours,
      overtimeHours: summary.overtimeHours,
      vacationHours: summary.vacationHours,
      sickHours: summary.sickHours,
      holidayHours: summary.holidayHours,
      attendanceLocked: true,
      attendanceEntryIds: summary.entryIds,
    };
  });
}

export interface AttendanceException {
  entryId: string;
  employeeId: string;
  employeeName?: string;
  workDate: string;
  clockIn: string;
  kind: 'missing_clock_out';
}

export function missingClockOuts(org: OrgAttendance, today: string): AttendanceException[] {
  return org.entries
    .filter((entry) => {
      const settings = org.employees[entry.employeeId];
      const required = settings?.clockOutRequired !== false;
      return entry.status === 'OPEN' && required && entry.workDate < today;
    })
    .map((entry) => ({
      entryId: entry.id,
      employeeId: entry.employeeId,
      employeeName: entry.employeeName,
      workDate: entry.workDate,
      clockIn: entry.clockIn,
      kind: 'missing_clock_out' as const,
    }));
}

export type AttendanceReportId =
  | 'employee-hours'
  | 'daily-clock'
  | 'weekly-hours'
  | 'pay-period-hours'
  | 'overtime'
  | 'late-arrival'
  | 'early-departure'
  | 'missing-clock-out'
  | 'breaks'
  | 'exceptions'
  | 'approvals'
  | 'payroll-time-summary'
  | 'employee-timesheet'
  | 'department-hours'
  | 'job-hours';

export interface ReportFilters {
  periodStart?: string;
  periodEnd?: string;
  employeeId?: string;
  department?: string;
  status?: AttendanceStatus | '';
  today?: string;
}

export function runReport(org: OrgAttendance, report: AttendanceReportId, filters: ReportFilters) {
  let rows = org.entries.filter((entry) => {
    if (filters.periodStart && entry.workDate < filters.periodStart) return false;
    if (filters.periodEnd && entry.workDate > filters.periodEnd) return false;
    if (filters.employeeId && entry.employeeId !== filters.employeeId) return false;
    if (filters.department && entry.department !== filters.department) return false;
    if (filters.status && entry.status !== filters.status) return false;
    return true;
  });
  if (report === 'overtime') rows = rows.filter((entry) => entry.overtimeHours > 0);
  if (report === 'missing-clock-out' || report === 'exceptions') {
    rows = org.entries.filter((entry) => missingClockOuts(org, filters.today ?? filters.periodEnd ?? '9999-12-31').some((item) => item.entryId === entry.id));
  }
  if (report === 'breaks') rows = rows.filter((entry) => entry.breakMinutes > 0);
  if (report === 'approvals') rows = rows.filter((entry) => entry.status === 'PENDING_APPROVAL' || entry.status === 'APPROVED' || entry.status === 'REJECTED');
  if (report === 'late-arrival') {
    rows = rows.filter((entry) => {
      const settings = org.employees[entry.employeeId];
      const scheduled = (settings?.schedule ?? DEFAULT_WEEKDAY_SCHEDULE).find((day) => day.day === weekdayOf(entry.workDate));
      if (!scheduled) return false;
      return minutesOfDay(entry.clockIn, entry.timezone) > wallMinutes(scheduled.start);
    });
  }
  if (report === 'early-departure') {
    rows = rows.filter((entry) => entry.clockOut && entry.paidHours > 0 && entry.paidHours < 8 && entry.overtimeHours === 0);
  }
  return rows.map((entry) => ({
    id: entry.id,
    employeeId: entry.employeeId,
    employeeName: entry.employeeName ?? entry.employeeId,
    department: entry.department ?? '',
    workDate: entry.workDate,
    clockIn: formatClock(entry.clockIn, entry.timezone),
    clockOut: formatClock(entry.clockOut, entry.timezone),
    breakMinutes: entry.breakMinutes,
    regularHours: entry.regularHours,
    overtimeHours: entry.overtimeHours,
    holidayHours: entry.holidayHours,
    paidHours: entry.paidHours,
    status: entry.status,
    source: entry.source,
  }));
}

function wallMinutes(hhmm: string): number {
  const [hour, minute] = hhmm.split(':').map(Number);
  return (hour ?? 0) * 60 + (minute ?? 0);
}

function minutesOfDay(iso: string, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: safeTimeZone(timeZone),
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso));
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? 0);
  return hour * 60 + minute;
}

export function scheduledPaidHours(schedule: DaySchedule[] | undefined, workDate: string, breakMinutes: number): number {
  const row = (schedule ?? DEFAULT_WEEKDAY_SCHEDULE).find((day) => day.day === weekdayOf(workDate));
  if (!row) return 0;
  return round2(Math.max(wallMinutes(row.end) - wallMinutes(row.start) - breakMinutes, 0) / 60);
}

export function auditTrailForPayroll(org: OrgAttendance, payrollRunId: string, employeeId: string) {
  const summary = org.summaries.find((item) => item.payrollRunId === payrollRunId && item.employeeId === employeeId);
  if (!summary) return null;
  const records = summary.entryIds
    .map((id) => org.entries.find((entry) => entry.id === id))
    .filter((entry): entry is TimeEntry => !!entry);
  return { summary, records, adjustments: org.adjustments.filter((item) => summary.entryIds.includes(item.timeEntryId)) };
}

export function dashboardForEmployee(org: OrgAttendance, employeeId: string, today: string) {
  const rows = org.entries.filter((entry) => entry.employeeId === employeeId && entry.workDate === today);
  const open = rows.find((entry) => entry.status === 'OPEN');
  const settings = org.employees[employeeId];
  const worked = round2(rows.reduce((sum, entry) => sum + (entry.status === 'OPEN' ? 0 : entry.paidHours), 0));
  const overtime = round2(rows.reduce((sum, entry) => sum + entry.overtimeHours, 0));
  return {
    scheduledHours: scheduledPaidHours(settings?.schedule, today, settings?.breakMinutes ?? org.company.autoBreakMinutes),
    workedHours: worked,
    overtimeHours: overtime,
    status: open ? 'CLOCKED IN' : worked > 0 ? 'CLOCKED OUT' : 'NOT CLOCKED IN',
  };
}

export function dashboardForManager(org: OrgAttendance, today: string, teamIds: string[]) {
  const todayRows = org.entries.filter((entry) => teamIds.includes(entry.employeeId) && entry.workDate === today);
  const present = new Set(todayRows.map((entry) => entry.employeeId));
  return {
    present: present.size,
    absent: Math.max(teamIds.length - present.size, 0),
    missingClockOut: missingClockOuts(org, today).filter((item) => teamIds.includes(item.employeeId)).length,
    pendingApproval: org.entries.filter((entry) => teamIds.includes(entry.employeeId) && entry.status === 'PENDING_APPROVAL').length,
  };
}

export const REPORT_CATALOG: Array<{ id: AttendanceReportId; name: string; description: string }> = [
  { id: 'employee-hours', name: 'Employee Hours Report', description: 'Paid, regular, and overtime hours by employee' },
  { id: 'daily-clock', name: 'Daily Clock-In/Out Report', description: 'Clock in and clock out for each day' },
  { id: 'weekly-hours', name: 'Weekly Hours Report', description: 'Hours grouped by work week' },
  { id: 'pay-period-hours', name: 'Pay-Period Hours Report', description: 'Hours inside the selected pay period' },
  { id: 'overtime', name: 'Overtime Report', description: 'Shifts with overtime hours' },
  { id: 'late-arrival', name: 'Late Arrival Report', description: 'Clock-ins after the scheduled start' },
  { id: 'early-departure', name: 'Early Departure Report', description: 'Shifts shorter than a standard day' },
  { id: 'missing-clock-out', name: 'Missing Clock-Out Report', description: 'Open shifts from a previous day' },
  { id: 'breaks', name: 'Break Report', description: 'Recorded break minutes' },
  { id: 'exceptions', name: 'Attendance Exceptions Report', description: 'Missing clock-outs and other exceptions' },
  { id: 'approvals', name: 'Manager Approval Report', description: 'Records waiting for or finished with approval' },
  { id: 'payroll-time-summary', name: 'Payroll Time Summary', description: 'Approved hours ready for payroll' },
  { id: 'employee-timesheet', name: 'Employee Timesheet', description: 'One employee’s clock records' },
  { id: 'department-hours', name: 'Department Hours Report', description: 'Hours by department' },
  { id: 'job-hours', name: 'Job/Project Hours Report', description: 'Hours by job or department' },
];
