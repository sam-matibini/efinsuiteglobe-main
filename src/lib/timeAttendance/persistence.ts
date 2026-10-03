import { supabase } from '@/integrations/supabase/client';
import { handleTimeApi } from '@/lib/timeAttendance/api';
import { emptyOrg } from '@/lib/timeAttendance/engine';
import type {
  CompanyTimeSettings,
  EmployeeTimeSettings,
  OrgAttendance,
  TimeAdjustment,
  TimeApproval,
  TimeEntry,
} from '@/lib/timeAttendance/types';

const db = supabase as unknown as {
  from: (table: string) => any;
};

function missingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const message = error.message ?? '';
  return error.code === '42P01' || error.code === 'PGRST205' || /does not exist|schema cache/i.test(message);
}

function companyFromRow(row: Record<string, any>): CompanyTimeSettings {
  return {
    organizationId: row.organization_id,
    enabled: !!row.enabled,
    clockInOutEnabled: row.clock_in_out_enabled !== false,
    payrollIntegration: row.payroll_integration !== false,
    managerApprovalRequired: !!row.manager_approval_required,
    overtimeEnabled: row.overtime_enabled !== false,
    breakTrackingEnabled: row.break_tracking_enabled !== false,
    breakMode: row.break_mode,
    autoBreakMinutes: row.auto_break_minutes ?? 30,
    timezone: row.timezone || 'America/Toronto',
    allowUnresolvedPayroll: !!row.allow_unresolved_payroll,
    overtimePolicy: {
      dailyRegularLimit: Number(row.daily_regular_limit ?? 8),
      weeklyRegularLimit: Number(row.weekly_regular_limit ?? 40),
      overtimeMultiplier: Number(row.overtime_multiplier ?? 1.5),
    },
  };
}

function entryFromRow(row: Record<string, any>): TimeEntry {
  return {
    id: row.id,
    organizationId: row.organization_id,
    employeeId: row.employee_id,
    employeeName: row.employee_name ?? undefined,
    department: row.department,
    workDate: String(row.work_date).slice(0, 10),
    clockIn: row.clock_in,
    clockOut: row.clock_out,
    timezone: row.timezone,
    breakMinutes: row.break_minutes ?? 0,
    grossHours: Number(row.gross_hours ?? 0),
    paidHours: Number(row.paid_hours ?? 0),
    regularHours: Number(row.regular_hours ?? 0),
    overtimeHours: Number(row.overtime_hours ?? 0),
    holidayHours: Number(row.holiday_hours ?? 0),
    vacationHours: Number(row.vacation_hours ?? 0),
    sickHours: Number(row.sick_hours ?? 0),
    status: row.status,
    source: row.source,
    notes: row.notes,
    breaks: row.breaks ?? [],
    originalClockIn: row.original_clock_in,
    originalClockOut: row.original_clock_out,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function loadOrgFromSupabase(organizationId: string): Promise<OrgAttendance | null> {
  const settings = await db.from('time_attendance_settings').select('*').eq('organization_id', organizationId).maybeSingle();
  if (missingTable(settings.error)) return null;
  if (settings.error) return emptyOrg(organizationId);
  const org = emptyOrg(organizationId);
  if (settings.data) org.company = companyFromRow(settings.data);

  const [employeeSettings, entries, audit] = await Promise.all([
    db.from('employee_time_settings').select('*').eq('organization_id', organizationId),
    db.from('employee_time_entries').select('*').eq('organization_id', organizationId),
    db.from('time_attendance_audit').select('*').eq('organization_id', organizationId).order('at'),
  ]);
  if (missingTable(employeeSettings.error) || missingTable(entries.error)) return null;

  for (const row of employeeSettings.data ?? []) {
    const settingsRow: EmployeeTimeSettings = {
      organizationId: row.organization_id,
      employeeId: row.employee_id,
      enabled: row.enabled,
      clockInRequired: row.clock_in_required !== false,
      clockOutRequired: row.clock_out_required !== false,
      schedule: row.schedule ?? [],
      breakMinutes: row.break_minutes ?? 30,
      overtimeRule: row.overtime_rule === 'none' ? 'none' : 'company_default',
      payType: row.pay_type === 'salary' ? 'salary' : 'hourly',
    };
    org.employees[row.employee_id] = settingsRow;
  }
  org.entries = (entries.data ?? []).map(entryFromRow);

  const entryIds = org.entries.map((entry) => entry.id);
  if (entryIds.length > 0) {
    const [adjustments, approvals, summaries] = await Promise.all([
      db.from('time_entry_adjustments').select('*').in('time_entry_id', entryIds),
      db.from('time_approvals').select('*').in('time_entry_id', entryIds),
      db.from('payroll_time_summary').select('*').in('employee_id', Array.from(new Set(org.entries.map((entry) => entry.employeeId)))),
    ]);
    org.adjustments = (adjustments.data ?? []).map((row: Record<string, any>): TimeAdjustment => ({
      id: row.id,
      timeEntryId: row.time_entry_id,
      fieldName: row.field_name,
      originalValue: row.original_value,
      newValue: row.new_value,
      reason: row.reason,
      adjustedBy: row.adjusted_by,
      adjustedAt: row.adjusted_at,
    }));
    org.approvals = (approvals.data ?? []).map((row: Record<string, any>): TimeApproval => ({
      id: row.id,
      timeEntryId: row.time_entry_id,
      approverId: row.approver_id,
      status: row.status,
      comments: row.comments,
      approvedAt: row.approved_at,
    }));
    org.summaries = (summaries.data ?? []).map((row: Record<string, any>) => ({
      id: row.id,
      payrollRunId: row.payroll_run_id,
      employeeId: row.employee_id,
      regularHours: Number(row.regular_hours ?? 0),
      overtimeHours: Number(row.overtime_hours ?? 0),
      holidayHours: Number(row.holiday_hours ?? 0),
      vacationHours: Number(row.vacation_hours ?? 0),
      sickHours: Number(row.sick_hours ?? 0),
      totalHours: Number(row.total_hours ?? 0),
      entryIds: row.entry_ids ?? [],
      daily: row.daily ?? [],
      createdAt: row.created_at,
    }));
  }
  org.audit = (audit.data ?? []).map((row: Record<string, any>) => ({
    id: row.id,
    at: row.at,
    actorId: row.actor_id,
    role: row.role,
    action: row.action,
    entityId: row.entity_id,
    detail: row.detail,
  }));
  return org;
}

export async function saveOrgToSupabase(org: OrgAttendance): Promise<void> {
  const company = org.company;
  const settings = await db.from('time_attendance_settings').upsert({
    organization_id: company.organizationId,
    enabled: company.enabled,
    clock_in_out_enabled: company.clockInOutEnabled,
    payroll_integration: company.payrollIntegration,
    manager_approval_required: company.managerApprovalRequired,
    overtime_enabled: company.overtimeEnabled,
    break_tracking_enabled: company.breakTrackingEnabled,
    break_mode: company.breakMode,
    auto_break_minutes: company.autoBreakMinutes,
    timezone: company.timezone,
    allow_unresolved_payroll: company.allowUnresolvedPayroll,
    daily_regular_limit: company.overtimePolicy.dailyRegularLimit,
    weekly_regular_limit: company.overtimePolicy.weeklyRegularLimit,
    overtime_multiplier: company.overtimePolicy.overtimeMultiplier,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'organization_id' });
  if (settings.error) throw new Error(settings.error.message);

  if (Object.keys(org.employees).length > 0) {
    const employeeRows = Object.values(org.employees).map((row) => ({
      organization_id: row.organizationId,
      employee_id: row.employeeId,
      enabled: row.enabled,
      clock_in_required: row.clockInRequired,
      clock_out_required: row.clockOutRequired,
      schedule: row.schedule,
      break_minutes: row.breakMinutes,
      overtime_rule: row.overtimeRule,
      pay_type: row.payType,
      updated_at: new Date().toISOString(),
    }));
    const saved = await db.from('employee_time_settings').upsert(employeeRows, { onConflict: 'organization_id,employee_id' });
    if (saved.error) throw new Error(saved.error.message);
  }

  if (org.entries.length > 0) {
    const entryRows = org.entries.map((entry) => ({
      id: entry.id,
      organization_id: entry.organizationId,
      employee_id: entry.employeeId,
      employee_name: entry.employeeName ?? null,
      department: entry.department ?? null,
      work_date: entry.workDate,
      clock_in: entry.clockIn,
      clock_out: entry.clockOut,
      timezone: entry.timezone,
      break_minutes: entry.breakMinutes,
      gross_hours: entry.grossHours,
      paid_hours: entry.paidHours,
      regular_hours: entry.regularHours,
      overtime_hours: entry.overtimeHours,
      holiday_hours: entry.holidayHours,
      vacation_hours: entry.vacationHours,
      sick_hours: entry.sickHours,
      status: entry.status,
      source: entry.source,
      notes: entry.notes,
      breaks: entry.breaks,
      original_clock_in: entry.originalClockIn,
      original_clock_out: entry.originalClockOut,
      created_at: entry.createdAt,
      updated_at: entry.updatedAt,
    }));
    const saved = await db.from('employee_time_entries').upsert(entryRows);
    if (saved.error) throw new Error(saved.error.message);
  }

  const extra = [
    org.adjustments.length > 0
      ? db.from('time_entry_adjustments').upsert(org.adjustments.map((row) => ({
        id: row.id,
        time_entry_id: row.timeEntryId,
        field_name: row.fieldName,
        original_value: row.originalValue,
        new_value: row.newValue,
        reason: row.reason,
        adjusted_by: row.adjustedBy,
        adjusted_at: row.adjustedAt,
      })))
      : Promise.resolve({ error: null }),
    org.approvals.length > 0
      ? db.from('time_approvals').upsert(org.approvals.map((row) => ({
        id: row.id,
        time_entry_id: row.timeEntryId,
        approver_id: row.approverId,
        status: row.status,
        comments: row.comments,
        approved_at: row.approvedAt,
      })))
      : Promise.resolve({ error: null }),
    org.summaries.length > 0
      ? db.from('payroll_time_summary').upsert(org.summaries.map((row) => ({
        id: row.id,
        payroll_run_id: row.payrollRunId,
        employee_id: row.employeeId,
        regular_hours: row.regularHours,
        overtime_hours: row.overtimeHours,
        holiday_hours: row.holidayHours,
        vacation_hours: row.vacationHours,
        sick_hours: row.sickHours,
        total_hours: row.totalHours,
        entry_ids: row.entryIds,
        daily: row.daily,
        created_at: row.createdAt,
      })))
      : Promise.resolve({ error: null }),
    org.audit.length > 0
      ? db.from('time_attendance_audit').upsert(org.audit.map((row) => ({
        id: row.id,
        organization_id: org.company.organizationId,
        at: row.at,
        actor_id: row.actorId,
        role: row.role,
        action: row.action,
        entity_id: row.entityId,
        detail: row.detail,
      })), { onConflict: 'id', ignoreDuplicates: true })
      : Promise.resolve({ error: null }),
  ];
  const results = await Promise.all(extra);
  const failed = results.find((result) => result.error);
  if (failed?.error) throw new Error(failed.error.message);
}

export async function timeRequest(
  method: 'GET' | 'POST' | 'PUT',
  path: string,
  body: Record<string, unknown> = {},
  query: Record<string, string> = {},
): Promise<{ status: number; body: any }> {
  const organizationId = String(body.organizationId || query.organizationId || '');
  try {
    const search = new URLSearchParams(query).toString();
    const response = await fetch(search ? `${path}?${search}` : path, {
      method,
      headers: method === 'GET' ? undefined : { 'Content-Type': 'application/json' },
      body: method === 'GET' ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    try {
      const json = JSON.parse(text);
      if (json && (response.ok || json.ok === false || typeof json.error === 'string')) {
        return { status: response.status, body: json };
      }
    } catch {
      // The dev API is not mounted. Fall through to Supabase.
    }
  } catch {
    // Network failure uses the database path below.
  }

  if (!organizationId) return { status: 400, body: { ok: false, error: 'organizationId is required.' } };
  const current = await loadOrgFromSupabase(organizationId);
  if (!current) {
    return { status: 503, body: { ok: false, error: 'Time attendance storage is not available yet.' } };
  }
  const result = handleTimeApi({ method, path, body, query }, { [organizationId]: current });
  const next = result.store[organizationId];
  if (result.status < 400 && next && next !== current) {
    await saveOrgToSupabase(next);
  }
  return { status: result.status, body: result.body };
}
