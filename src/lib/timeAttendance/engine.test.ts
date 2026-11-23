import { describe, expect, it } from 'vitest';
import { handleTimeApi } from './api';
import {
  adjustEntry,
  approveEntry,
  auditTrailForPayroll,
  clockIn,
  clockOut,
  configureCompany,
  configureEmployee,
  defaultCompanySettings,
  earningsFromSummary,
  emptyOrg,
  exportToPayroll,
  inferPayType,
  missingClockOuts,
  overlayApprovedHours,
  payrollReadiness,
  requestCorrection,
  resolveTracking,
  runReport,
  startBreak,
  endBreak,
} from './engine';
import type { Actor, EmployeeTimeSettings } from './types';

const admin: Actor = { userId: 'admin-1', role: 'company_admin' };
const manager: Actor = { userId: 'mgr-1', role: 'manager', employeeId: 'mgr', teamEmployeeIds: ['emp-1'] };
const employee: Actor = { userId: 'user-1', role: 'employee', employeeId: 'emp-1' };
const atIn = '2026-10-05T12:02:00.000Z';
const atOut = '2026-10-05T20:31:00.000Z';

function enabledOrg() {
  const org = emptyOrg('org-1');
  org.company = {
    ...defaultCompanySettings('org-1'),
    enabled: true,
    timezone: 'UTC',
    managerApprovalRequired: true,
    breakMode: 'unpaid',
    breakTrackingEnabled: true,
  };
  return org;
}

describe('time attendance optionality', () => {
  it('stays off until the company turns it on', () => {
    const org = emptyOrg('org-1');
    expect(org.company.enabled).toBe(false);
    expect(resolveTracking(org.company, null, 'hourly')).toBe(false);
    const blocked = clockIn(org, { employeeId: 'emp-1', payType: 'hourly', at: atIn, source: 'WEB', actor: employee });
    expect(blocked.error).toMatch(/not enabled/);
  });

  it('leaves salaried employees off unless an administrator enables them', () => {
    const org = enabledOrg();
    expect(resolveTracking(org.company, null, 'salary')).toBe(false);
    expect(resolveTracking(org.company, null, 'hourly')).toBe(true);
    expect(inferPayType({ annual_salary: 80000, hourly_rate: null })).toBe('salary');
    expect(inferPayType({ annual_salary: null, hourly_rate: 25 })).toBe('hourly');
    const settings: EmployeeTimeSettings = {
      organizationId: 'org-1',
      employeeId: 'sal-1',
      enabled: true,
      clockInRequired: false,
      clockOutRequired: false,
      schedule: [],
      breakMinutes: 0,
      overtimeRule: 'company_default',
      payType: 'salary',
    };
    expect(resolveTracking(org.company, settings, 'salary')).toBe(true);
  });

  it('lets HR turn tracking off for one hourly employee', () => {
    const org = enabledOrg();
    const saved = configureEmployee(org, {
      organizationId: 'org-1',
      employeeId: 'emp-1',
      enabled: false,
      clockInRequired: true,
      clockOutRequired: true,
      schedule: [],
      breakMinutes: 30,
      overtimeRule: 'company_default',
      payType: 'hourly',
    }, admin, atIn);
    expect(resolveTracking(saved.org.company, saved.org.employees['emp-1'], 'hourly')).toBe(false);
  });
});

describe('clock in and clock out', () => {
  it('rejects a second clock-in and a clock-out with no open shift', () => {
    let org = enabledOrg();
    const first = clockIn(org, { employeeId: 'emp-1', payType: 'hourly', at: atIn, source: 'WEB', actor: employee });
    org = first.org;
    const duplicate = clockIn(org, { employeeId: 'emp-1', payType: 'hourly', at: atIn, source: 'WEB', actor: employee });
    expect(duplicate.error).toBe('You are already clocked in at 12:02 PM.');
    const bare = clockOut(enabledOrg(), { employeeId: 'emp-1', payType: 'hourly', at: atOut, actor: employee });
    expect(bare.error).toBe('No active clock-in was found.');
  });

  it('calculates gross, unpaid break, and paid hours without letting the employee set hours', () => {
    let org = enabledOrg();
    org = clockIn(org, { employeeId: 'emp-1', employeeName: 'John Smith', payType: 'hourly', at: atIn, source: 'WEB', actor: employee }).org;
    org = startBreak(org, { employeeId: 'emp-1', at: '2026-10-05T16:00:00.000Z', actor: employee }).org;
    org = endBreak(org, { employeeId: 'emp-1', at: '2026-10-05T16:30:00.000Z', actor: employee }).org;
    const closed = clockOut(org, { employeeId: 'emp-1', payType: 'hourly', at: atOut, actor: employee });
    expect(closed.receipt).toMatchObject({
      grossHours: 8.48,
      paidHours: 7.98,
      breakMinutes: 30,
      regularHours: 7.98,
      overtimeHours: 0,
    });
    expect(closed.entry?.status).toBe('PENDING_APPROVAL');
  });

  it('allows a second shift on the same day', () => {
    let org = enabledOrg();
    org.company.managerApprovalRequired = false;
    org = clockIn(org, { employeeId: 'emp-1', payType: 'hourly', at: '2026-10-05T12:00:00.000Z', source: 'WEB', actor: employee }).org;
    org = clockOut(org, { employeeId: 'emp-1', payType: 'hourly', at: '2026-10-05T16:00:00.000Z', actor: employee }).org;
    const second = clockIn(org, { employeeId: 'emp-1', payType: 'hourly', at: '2026-10-05T18:00:00.000Z', source: 'WEB', actor: employee });
    expect(second.error).toBeUndefined();
    expect(second.org.entries.filter((entry) => entry.workDate === '2026-10-05')).toHaveLength(2);
  });

  it('uses the employer overtime policy instead of a fixed clock rule', () => {
    let org = enabledOrg();
    org.company.managerApprovalRequired = false;
    org.company.overtimePolicy = { dailyRegularLimit: 8, weeklyRegularLimit: 40, overtimeMultiplier: 1.5 };
    org.company.breakMode = 'paid';
    org = clockIn(org, { employeeId: 'emp-1', payType: 'hourly', at: '2026-10-05T12:00:00.000Z', source: 'WEB', actor: employee }).org;
    const closed = clockOut(org, { employeeId: 'emp-1', payType: 'hourly', at: '2026-10-05T22:00:00.000Z', actor: employee });
    expect(closed.entry?.regularHours).toBe(8);
    expect(closed.entry?.overtimeHours).toBe(2);
    org.company.overtimeEnabled = false;
    org = clockIn(closed.org, { employeeId: 'emp-2', payType: 'hourly', at: '2026-10-05T12:00:00.000Z', source: 'WEB', actor: { ...employee, employeeId: 'emp-2' } }).org;
    const noOt = clockOut(org, { employeeId: 'emp-2', payType: 'hourly', at: '2026-10-05T22:00:00.000Z', actor: { ...employee, employeeId: 'emp-2' } });
    expect(noOt.entry?.regularHours).toBe(10);
    expect(noOt.entry?.overtimeHours).toBe(0);
  });
});

describe('approval, adjustments, and payroll', () => {
  function pending() {
    let org = enabledOrg();
    org = clockIn(org, { employeeId: 'emp-1', employeeName: 'John Smith', payType: 'hourly', at: atIn, source: 'WEB', actor: employee }).org;
    org = clockOut(org, { employeeId: 'emp-1', payType: 'hourly', at: atOut, actor: employee }).org;
    return org;
  }

  it('blocks an employee from approving their own correction', () => {
    let org = pending();
    const entryId = org.entries[0].id;
    org = requestCorrection(org, { entryId, actor: employee, at: atOut, reason: 'Forgot to clock out' }).org;
    const self = approveEntry(org, { entryId, actor: employee, at: atOut });
    expect(self.error).toMatch(/cannot approve/);
    const approved = approveEntry(org, { entryId, actor: manager, at: atOut });
    expect(approved.org.entries[0].status).toBe('APPROVED');
  });

  it('keeps the original clock time when a manager adjusts the record', () => {
    let org = pending();
    const entryId = org.entries[0].id;
    const originalIn = org.entries[0].clockIn;
    const adjusted = adjustEntry(org, {
      entryId,
      actor: manager,
      at: '2026-10-05T21:00:00.000Z',
      reason: 'Employee forgot to clock out.',
      clockOut: '2026-10-05T20:05:00.000Z',
    });
    expect(adjusted.error).toBeUndefined();
    const entry = adjusted.org.entries[0];
    expect(entry.originalClockIn).toBe(originalIn);
    expect(entry.clockOut).toBe('2026-10-05T20:05:00.000Z');
    expect(adjusted.org.adjustments.some((item) => item.fieldName === 'clock_out' && item.adjustedBy === 'mgr-1')).toBe(true);
    expect(entry.status).toBe('PENDING_APPROVAL');
  });

  it('feeds only approved hours into payroll and leaves other employees alone', () => {
    let org = pending();
    const entryId = org.entries[0].id;
    org = approveEntry(org, { entryId, actor: manager, at: atOut }).org;
    const sheets = overlayApprovedHours(
      [
        { employeeId: 'emp-1', regularHours: 80, overtimeHours: 0, vacationHours: 0, sickHours: 0 },
        { employeeId: 'sal-1', regularHours: 80, overtimeHours: 0, vacationHours: 0, sickHours: 0 },
      ],
      org,
      '2026-10-01',
      '2026-10-15',
      [
        { id: 'emp-1', payType: 'hourly' },
        { id: 'sal-1', payType: 'salary' },
      ],
    );
    expect(sheets[0].regularHours).toBe(8);
    expect(sheets[0].overtimeHours).toBe(0.48);
    expect(sheets[0].attendanceLocked).toBe(true);
    expect(sheets[1].regularHours).toBe(80);
    expect(sheets[1].attendanceLocked).toBeUndefined();

    const earnings = earningsFromSummary(
      { regularHours: 72, overtimeHours: 6.5, holidayHours: 8 },
      25,
      { overtimeMultiplier: 1.5 },
    );
    expect(earnings).toEqual({
      regularEarnings: 1800,
      overtimeEarnings: 243.75,
      holidayEarnings: 200,
      grossEarnings: 2243.75,
    });
  });

  it('does not change payroll when time tracking is off', () => {
    const org = emptyOrg('org-1');
    const sheets = overlayApprovedHours(
      [{ employeeId: 'emp-1', regularHours: 80, overtimeHours: 2, vacationHours: 0, sickHours: 0 }],
      org,
      '2026-10-01',
      '2026-10-15',
      [{ id: 'emp-1', payType: 'hourly' }],
    );
    expect(sheets[0].regularHours).toBe(80);
    const readiness = payrollReadiness(org, {
      periodStart: '2026-10-01',
      periodEnd: '2026-10-15',
      today: '2026-10-06',
      employees: [{ id: 'emp-1', payType: 'hourly' }],
    });
    expect(readiness.enabled).toBe(false);
    expect(readiness.canFinalize).toBe(true);
  });

  it('warns before finalize when hours are still unapproved', () => {
    const org = pending();
    const readiness = payrollReadiness(org, {
      periodStart: '2026-10-01',
      periodEnd: '2026-10-15',
      today: '2026-10-06',
      employees: [{ id: 'emp-1', payType: 'hourly' }],
    });
    expect(readiness.pendingApproval).toBe(1);
    expect(readiness.canFinalize).toBe(false);
    expect(readiness.warning).toMatch(/unapproved hours/);
  });

  it('traces payroll hours back to the clock records', () => {
    let org = pending();
    org = approveEntry(org, { entryId: org.entries[0].id, actor: manager, at: atOut }).org;
    const exported = exportToPayroll(org, {
      payrollRunId: 'PR-2026-10-001',
      periodStart: '2026-10-01',
      periodEnd: '2026-10-15',
      employeeIds: ['emp-1'],
      at: atOut,
      actor: admin,
    });
    expect(exported.summaries[0].regularHours).toBe(8);
    expect(exported.summaries[0].overtimeHours).toBe(0.48);
    expect(exported.org.entries[0].status).toBe('EXPORTED_TO_PAYROLL');
    const trail = auditTrailForPayroll(exported.org, 'PR-2026-10-001', 'emp-1');
    expect(trail?.records).toHaveLength(1);
    expect(trail?.records[0].workDate).toBe('2026-10-05');
  });

  it('raises a missing clock-out exception', () => {
    let org = enabledOrg();
    org = clockIn(org, {
      employeeId: 'emp-1',
      employeeName: 'John Smith',
      payType: 'hourly',
      at: '2026-10-03T12:01:00.000Z',
      source: 'WEB',
      actor: employee,
    }).org;
    const exceptions = missingClockOuts(org, '2026-10-04');
    expect(exceptions).toHaveLength(1);
    expect(runReport(org, 'missing-clock-out', { today: '2026-10-04' })).toHaveLength(1);
  });
});

describe('time attendance API', () => {
  it('clocks in, clocks out, and refuses a duplicate through the API', () => {
    const actor = employee;
    let store = {};
    const settings = handleTimeApi({
      method: 'PUT',
      path: '/api/time/settings',
      body: {
        organizationId: 'org-1',
        at: atIn,
        actor: admin,
        settings: { ...defaultCompanySettings('org-1'), enabled: true, timezone: 'UTC', managerApprovalRequired: false, breakMode: 'automatic', autoBreakMinutes: 30 },
      },
    }, store);
    store = settings.store;
    const started = handleTimeApi({
      method: 'POST',
      path: '/api/time/clock-in',
      body: { organizationId: 'org-1', employeeId: 'emp-1', payType: 'hourly', at: atIn, source: 'API', actor },
    }, store);
    expect(started.status).toBe(201);
    store = started.store;
    const again = handleTimeApi({
      method: 'POST',
      path: '/api/time/clock-in',
      body: { organizationId: 'org-1', employeeId: 'emp-1', payType: 'hourly', at: atIn, source: 'API', actor },
    }, store);
    expect(again.status).toBe(409);
    const finished = handleTimeApi({
      method: 'POST',
      path: '/api/time/clock-out',
      body: { organizationId: 'org-1', employeeId: 'emp-1', payType: 'hourly', at: atOut, actor },
    }, store);
    expect(finished.status).toBe(200);
    expect((finished.body as { receipt: { paidHours: number } }).receipt.paidHours).toBe(7.98);
  });
});
