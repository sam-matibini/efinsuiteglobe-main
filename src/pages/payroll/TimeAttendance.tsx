import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { ServicesCheckoutPanel } from '@/components/timeAttendance/ServicesCheckoutPanel';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAttendanceActor } from '@/hooks/useAttendanceActor';
import { useEmployees } from '@/hooks/useEmployees';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { useTimeAttendance } from '@/hooks/useTimeAttendance';
import {
  calendarDate,
  dashboardForManager,
  formatClock,
  inferPayType,
  missingClockOuts,
  payrollReadiness,
  runReport,
} from '@/lib/timeAttendance/engine';
import type { CompanyTimeSettings } from '@/lib/timeAttendance/types';

export default function TimeAttendance() {
  const { organization } = useCurrentOrganization();
  const actor = useAttendanceActor();
  const { employees } = useEmployees();
  const { org, send } = useTimeAttendance(organization?.id, actor);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState('Employee forgot to clock out.');
  const [clockOut, setClockOut] = useState('');

  const timezone = org?.company?.timezone || 'America/Toronto';
  const today = org?.company ? calendarDate(new Date().toISOString(), timezone) : '';
  const monthStart = today ? `${today.slice(0, 7)}-01` : '';
  const teamIds = employees.map((employee) => employee.id);
  const manager = org && today ? dashboardForManager(org, today, teamIds) : null;
  const late = org && today ? runReport(org, 'late-arrival', { periodStart: today, periodEnd: today, today }).length : 0;
  const readiness = useMemo(() => {
    if (!org || !today) return null;
    return payrollReadiness(org, {
      periodStart: monthStart,
      periodEnd: today,
      today,
      employees: employees.map((employee) => ({ id: employee.id, payType: inferPayType(employee) })),
    });
  }, [org, today, monthStart, employees]);
  const pending = org?.entries.filter((entry) => entry.status === 'PENDING_APPROVAL') ?? [];
  const pendingHours = pending.reduce((sum, entry) => sum + entry.paidHours, 0);
  const exceptions = org && today ? missingClockOuts(org, today) : [];

  async function saveCompany(company: CompanyTimeSettings) {
    setBusy(true);
    try {
      await send('PUT', '/api/time/settings', { settings: company });
      toast.success(company.enabled ? 'Time & Attendance is on' : 'Time & Attendance is off');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save services');
    } finally {
      setBusy(false);
    }
  }

  async function act(path: string, body: Record<string, unknown>, success: string) {
    setBusy(true);
    try {
      await send('POST', path, body);
      toast.success(success);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  }

  if (!organization) {
    return <p className="text-muted-foreground">Select a company to configure Time & Attendance.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Time & Attendance</h1>
          <p className="text-sm text-muted-foreground">
            Optional clock-in for this company. Approved hours feed payroll. Turning it off leaves payroll on salary and entered hours.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link to="/payroll/time-attendance/reports">Reports</Link>
        </Button>
      </div>

      {org?.company && <ServicesCheckoutPanel company={org.company} busy={busy} onSave={saveCompany} />}

      {org?.company?.enabled && manager && readiness && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Team attendance</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 text-sm">
              <Metric label="Present" value={manager.present} />
              <Metric label="Absent" value={manager.absent} />
              <Metric label="Late" value={late} />
              <Metric label="Missing clock-out" value={manager.missingClockOut} />
              <Metric label="Pending approval" value={manager.pendingApproval} />
              <Button variant="outline" asChild><Link to="/payroll/time-attendance/reports?report=approvals">Review</Link></Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Payroll readiness</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>Employees using time tracking: {readiness.employeesUsingTimeTracking}</p>
              <p>Completed timesheets: {readiness.completedTimesheets}</p>
              <p>Pending approval: {readiness.pendingApproval} ({pendingHours.toFixed(2)} hrs)</p>
              <p>Missing clock-out: {readiness.missingClockOut}</p>
              <p>Approved hours: {readiness.approvedHours.toFixed(2)}</p>
              <p className="font-medium">{readiness.warning ? `Review required. ${readiness.warning}` : 'Payroll status: ready'}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {org?.company?.enabled && (
        <Card>
          <CardHeader><CardTitle>Manager review</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {pending.length === 0 && <p className="text-sm text-muted-foreground">No records are waiting for approval.</p>}
            {pending.map((entry) => (
              <div key={entry.id} className="flex flex-wrap items-center justify-between gap-2 border-b py-2 text-sm">
                <span>{entry.employeeName || entry.employeeId} · {entry.workDate} · {entry.paidHours.toFixed(2)} hrs</span>
                <span className="flex gap-2">
                  <Button size="sm" disabled={busy} onClick={() => act(`/api/time/${entry.id}/approve`, { payType: inferPayType(employees.find((item) => item.id === entry.employeeId) ?? {}) }, 'Time record approved')}>Approve</Button>
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => act(`/api/time/${entry.id}/reject`, { comments: 'Rejected' }, 'Time record rejected')}>Reject</Button>
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {org?.company?.enabled && (
        <Card>
          <CardHeader><CardTitle>Attendance exceptions</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {exceptions.length === 0 && <p className="text-sm text-muted-foreground">No missing clock-outs.</p>}
            {exceptions.map((item) => {
              const person = employees.find((employee) => employee.id === item.employeeId);
              return (
                <div key={item.entryId} className="space-y-2 rounded-md border p-3 text-sm">
                  <p className="font-medium">Attendance exception</p>
                  <p>Employee: {item.employeeName || (person ? `${person.first_name} ${person.last_name}` : item.employeeId)}</p>
                  <p>Date: {item.workDate}</p>
                  <p>Clock in: {formatClock(item.clockIn, timezone)}</p>
                  <p>Clock out: Missing</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Input type="datetime-local" value={clockOut} onChange={(event) => setClockOut(event.target.value)} className="max-w-xs" />
                    <Input value={reason} onChange={(event) => setReason(event.target.value)} className="max-w-sm" />
                    <Button
                      size="sm"
                      disabled={busy || !clockOut || !reason.trim()}
                      onClick={() => act(`/api/time/${item.entryId}/adjust`, {
                        clockOut: new Date(clockOut).toISOString(),
                        reason,
                        payType: inferPayType(person ?? {}),
                      }, 'Clock-out corrected')}
                    >
                      Correct
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!person?.email}
                      onClick={() => {
                        if (person?.email) window.location.href = `mailto:${person.email}?subject=Missing clock-out ${item.workDate}`;
                      }}
                    >
                      Contact employee
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy || !clockOut}
                      onClick={() => act(`/api/time/${item.entryId}/adjust`, {
                        clockOut: new Date(clockOut).toISOString(),
                        reason: reason || 'Manager override',
                        payType: inferPayType(person ?? {}),
                      }, 'Manager override saved')}
                    >
                      Manager override
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {org && org.audit.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Audit log</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            {org.audit.slice(-12).reverse().map((event) => (
              <p key={event.id}>{event.at.slice(0, 16).replace('T', ' ')} · {event.role} · {event.action} · {event.detail}</p>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
    </div>
  );
}
