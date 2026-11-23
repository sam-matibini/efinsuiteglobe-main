export type AttendanceStatus =
  | 'OPEN'
  | 'COMPLETED'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'ADJUSTED'
  | 'LOCKED'
  | 'EXPORTED_TO_PAYROLL';

export type TimeSource = 'WEB' | 'MOBILE' | 'ADMIN' | 'API' | 'IMPORT';

export type BreakMode = 'paid' | 'unpaid' | 'automatic' | 'manual';

export type PayType = 'hourly' | 'salary';

export type AttendanceRole =
  | 'employee'
  | 'manager'
  | 'hr'
  | 'payroll_admin'
  | 'company_admin'
  | 'accountant';

export type Weekday =
  | 'sunday'
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday';

export interface OvertimePolicy {
  dailyRegularLimit: number;
  weeklyRegularLimit: number;
  overtimeMultiplier: number;
}

export interface CompanyTimeSettings {
  organizationId: string;
  enabled: boolean;
  clockInOutEnabled: boolean;
  payrollIntegration: boolean;
  managerApprovalRequired: boolean;
  overtimeEnabled: boolean;
  breakTrackingEnabled: boolean;
  breakMode: BreakMode;
  autoBreakMinutes: number;
  timezone: string;
  allowUnresolvedPayroll: boolean;
  overtimePolicy: OvertimePolicy;
}

export interface DaySchedule {
  day: Weekday;
  start: string;
  end: string;
}

export interface EmployeeTimeSettings {
  organizationId: string;
  employeeId: string;
  /** null inherits the company default for this pay type. */
  enabled: boolean | null;
  clockInRequired: boolean;
  clockOutRequired: boolean;
  schedule: DaySchedule[];
  breakMinutes: number;
  overtimeRule: 'company_default' | 'none';
  payType: PayType;
}

export interface BreakSpan {
  id: string;
  start: string;
  end: string | null;
  minutes: number;
}

export interface TimeEntry {
  id: string;
  organizationId: string;
  employeeId: string;
  employeeName?: string;
  department?: string | null;
  workDate: string;
  clockIn: string;
  clockOut: string | null;
  timezone: string;
  breakMinutes: number;
  grossHours: number;
  paidHours: number;
  regularHours: number;
  overtimeHours: number;
  holidayHours: number;
  vacationHours: number;
  sickHours: number;
  status: AttendanceStatus;
  source: TimeSource;
  notes: string | null;
  breaks: BreakSpan[];
  originalClockIn: string | null;
  originalClockOut: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TimeAdjustment {
  id: string;
  timeEntryId: string;
  fieldName: string;
  originalValue: string;
  newValue: string;
  reason: string;
  adjustedBy: string;
  adjustedAt: string;
}

export interface TimeApproval {
  id: string;
  timeEntryId: string;
  approverId: string;
  status: 'APPROVED' | 'REJECTED';
  comments: string | null;
  approvedAt: string;
}

export interface PayrollTimeDaily {
  workDate: string;
  entryId: string;
  regularHours: number;
  overtimeHours: number;
  holidayHours: number;
}

export interface PayrollTimeSummary {
  id: string;
  payrollRunId: string;
  employeeId: string;
  regularHours: number;
  overtimeHours: number;
  holidayHours: number;
  vacationHours: number;
  sickHours: number;
  totalHours: number;
  entryIds: string[];
  daily: PayrollTimeDaily[];
  createdAt: string;
}

export interface AuditEvent {
  id: string;
  at: string;
  actorId: string;
  role: AttendanceRole;
  action: string;
  entityId: string;
  detail: string;
}

export interface Actor {
  userId: string;
  role: AttendanceRole;
  employeeId?: string | null;
  teamEmployeeIds?: string[];
}

export interface OrgAttendance {
  company: CompanyTimeSettings;
  employees: Record<string, EmployeeTimeSettings>;
  entries: TimeEntry[];
  adjustments: TimeAdjustment[];
  approvals: TimeApproval[];
  summaries: PayrollTimeSummary[];
  audit: AuditEvent[];
}

export interface ClockOutReceipt {
  clockIn: string;
  clockOut: string;
  breakMinutes: number;
  grossHours: number;
  paidHours: number;
  regularHours: number;
  overtimeHours: number;
}

export const WEEKDAYS: Weekday[] = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

export const DEFAULT_WEEKDAY_SCHEDULE: DaySchedule[] = (
  ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'] as Weekday[]
).map((day) => ({ day, start: '08:00', end: '16:30' }));
