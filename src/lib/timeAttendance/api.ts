import {
  adjustEntry,
  approveEntry,
  clockIn,
  clockOut,
  configureCompany,
  configureEmployee,
  emptyOrg,
  endBreak,
  exportToPayroll,
  missingClockOuts,
  payrollReadiness,
  rejectEntry,
  requestCorrection,
  runReport,
  startBreak,
  summarizeEmployee,
  type AttendanceReportId,
} from './engine';
import type { Actor, CompanyTimeSettings, EmployeeTimeSettings, OrgAttendance, PayType, TimeSource } from './types';

export interface TimeApiRequest {
  method: string;
  path: string;
  body?: Record<string, unknown>;
  query?: Record<string, string>;
}

export interface TimeApiResponse {
  status: number;
  body: unknown;
  store: Record<string, OrgAttendance>;
}

function orgOf(store: Record<string, OrgAttendance>, organizationId: string): OrgAttendance {
  return store[organizationId] ?? emptyOrg(organizationId);
}

function actorFrom(body: Record<string, unknown> | undefined): Actor {
  const actor = (body?.actor ?? {}) as Partial<Actor>;
  return {
    userId: actor.userId || 'system',
    role: actor.role || 'employee',
    employeeId: actor.employeeId ?? null,
    teamEmployeeIds: actor.teamEmployeeIds,
  };
}

export function handleTimeApi(request: TimeApiRequest, store: Record<string, OrgAttendance>): TimeApiResponse {
  const body = request.body ?? {};
  const organizationId = String(body.organizationId || request.query?.organizationId || '');
  if (!organizationId) {
    return { status: 400, body: { ok: false, error: 'organizationId is required.' }, store };
  }
  const current = orgOf(store, organizationId);
  const actor = actorFrom(body);
  const at = String(body.at || new Date().toISOString());
  const commit = (org: OrgAttendance, status: number, payload: unknown): TimeApiResponse => ({
    status,
    body: payload,
    store: { ...store, [organizationId]: org },
  });
  const fail = (error: string, status = 400) => ({ status, body: { ok: false, error }, store });

  const path = request.path.replace(/\/$/, '');

  if (request.method === 'GET' && path === '/api/time/state') {
    return { status: 200, body: { ok: true, org: current }, store };
  }

  if (request.method === 'PUT' && path === '/api/time/settings') {
    const result = configureCompany(current, body.settings as Partial<CompanyTimeSettings>, actor, at);
    if (result.error) return fail(result.error, 403);
    return commit(result.org, 200, { ok: true, company: result.org.company });
  }

  if (request.method === 'PUT' && path === '/api/time/employee-settings') {
    const result = configureEmployee(current, body.settings as EmployeeTimeSettings, actor, at);
    if (result.error) return fail(result.error, 403);
    return commit(result.org, 200, { ok: true, settings: result.org.employees[(body.settings as EmployeeTimeSettings).employeeId] });
  }

  if (request.method === 'POST' && path === '/api/time/clock-in') {
    const result = clockIn(current, {
      employeeId: String(body.employeeId),
      employeeName: body.employeeName ? String(body.employeeName) : undefined,
      department: body.department ? String(body.department) : null,
      payType: (body.payType as PayType) || 'hourly',
      at,
      source: (body.source as TimeSource) || 'API',
      actor,
      notes: body.notes ? String(body.notes) : undefined,
    });
    if (result.error) return fail(result.error, result.error.includes('cannot') ? 403 : 409);
    return commit(result.org, 201, { ok: true, entry: result.entry });
  }

  if (request.method === 'POST' && path === '/api/time/clock-out') {
    const result = clockOut(current, {
      employeeId: String(body.employeeId),
      payType: (body.payType as PayType) || 'hourly',
      at,
      actor,
      notes: body.notes ? String(body.notes) : undefined,
    });
    if (result.error) return fail(result.error, 409);
    return commit(result.org, 200, { ok: true, entry: result.entry, receipt: result.receipt });
  }

  if (request.method === 'POST' && path === '/api/time/break/start') {
    const result = startBreak(current, { employeeId: String(body.employeeId), at, actor });
    if (result.error) return fail(result.error, 409);
    return commit(result.org, 200, { ok: true });
  }

  if (request.method === 'POST' && path === '/api/time/break/end') {
    const result = endBreak(current, { employeeId: String(body.employeeId), at, actor });
    if (result.error) return fail(result.error, 409);
    return commit(result.org, 200, { ok: true });
  }

  if (request.method === 'GET' && path === '/api/time/my-records') {
    const employeeId = request.query?.employeeId || actor.employeeId || '';
    return {
      status: 200,
      body: { ok: true, entries: current.entries.filter((entry) => entry.employeeId === employeeId) },
      store,
    };
  }

  const employeeMatch = path.match(/^\/api\/time\/employee\/([^/]+)$/);
  if (request.method === 'GET' && employeeMatch) {
    const employeeId = decodeURIComponent(employeeMatch[1]);
    if (actor.role === 'employee' && actor.employeeId !== employeeId) return fail('You can only view your own time.', 403);
    return {
      status: 200,
      body: { ok: true, entries: current.entries.filter((entry) => entry.employeeId === employeeId) },
      store,
    };
  }

  if (request.method === 'GET' && path === '/api/time/pending-approval') {
    return {
      status: 200,
      body: { ok: true, entries: current.entries.filter((entry) => entry.status === 'PENDING_APPROVAL') },
      store,
    };
  }

  const actionMatch = path.match(/^\/api\/time\/([^/]+)\/(approve|reject|adjust)$/);
  if (request.method === 'POST' && actionMatch) {
    const entryId = decodeURIComponent(actionMatch[1]);
    const action = actionMatch[2];
    if (action === 'approve') {
      const result = approveEntry(current, { entryId, actor, at, comments: body.comments ? String(body.comments) : undefined });
      if (result.error) return fail(result.error, 403);
      return commit(result.org, 200, { ok: true });
    }
    if (action === 'reject') {
      const result = rejectEntry(current, { entryId, actor, at, comments: body.comments ? String(body.comments) : undefined });
      if (result.error) return fail(result.error, 403);
      return commit(result.org, 200, { ok: true });
    }
    const result = adjustEntry(current, {
      entryId,
      actor,
      at,
      reason: String(body.reason || ''),
      clockIn: body.clockIn ? String(body.clockIn) : undefined,
      clockOut: body.clockOut ? String(body.clockOut) : undefined,
      holidayHours: body.holidayHours != null ? Number(body.holidayHours) : undefined,
      vacationHours: body.vacationHours != null ? Number(body.vacationHours) : undefined,
      sickHours: body.sickHours != null ? Number(body.sickHours) : undefined,
      payType: (body.payType as PayType) || 'hourly',
    });
    if (result.error) return fail(result.error, 403);
    return commit(result.org, 200, { ok: true });
  }

  if (request.method === 'POST' && path === '/api/time/correction') {
    const result = requestCorrection(current, {
      entryId: String(body.entryId),
      actor,
      at,
      reason: String(body.reason || ''),
    });
    if (result.error) return fail(result.error, 403);
    return commit(result.org, 200, { ok: true });
  }

  if (request.method === 'GET' && path === '/api/time/payroll-summary') {
    const periodStart = request.query?.periodStart || String(body.periodStart || '');
    const periodEnd = request.query?.periodEnd || String(body.periodEnd || '');
    const employeeId = request.query?.employeeId;
    const employees = current.entries
      .map((entry) => entry.employeeId)
      .filter((id, index, list) => list.indexOf(id) === index)
      .filter((id) => !employeeId || id === employeeId)
      .map((id) => summarizeEmployee(current, id, periodStart, periodEnd));
    return {
      status: 200,
      body: {
        ok: true,
        enabled: current.company.enabled && current.company.payrollIntegration,
        summaries: employees,
        readiness: payrollReadiness(current, {
          periodStart,
          periodEnd,
          today: request.query?.today || periodEnd,
          employees: employees.map((item) => ({
            id: item.employeeId,
            payType: current.employees[item.employeeId]?.payType ?? 'hourly',
          })),
        }),
      },
      store,
    };
  }

  if (request.method === 'POST' && path === '/api/time/export') {
    const result = exportToPayroll(current, {
      payrollRunId: String(body.payrollRunId),
      periodStart: String(body.periodStart),
      periodEnd: String(body.periodEnd),
      employeeIds: (body.employeeIds as string[]) ?? [],
      at,
      actor,
    });
    if (result.error) return fail(result.error, 403);
    return commit(result.org, 200, { ok: true, summaries: result.summaries, enabled: current.company.enabled });
  }

  if (request.method === 'GET' && path === '/api/time/reports') {
    const report = (request.query?.report || 'employee-hours') as AttendanceReportId;
    return {
      status: 200,
      body: {
        ok: true,
        rows: runReport(current, report, {
          periodStart: request.query?.periodStart,
          periodEnd: request.query?.periodEnd,
          employeeId: request.query?.employeeId,
          department: request.query?.department,
          status: (request.query?.status as OrgAttendance['entries'][number]['status']) || '',
          today: request.query?.today,
        }),
        exceptions: missingClockOuts(current, request.query?.today || request.query?.periodEnd || '9999-12-31'),
      },
      store,
    };
  }

  return { status: 404, body: { ok: false, error: 'Unknown time attendance route.' }, store };
}
