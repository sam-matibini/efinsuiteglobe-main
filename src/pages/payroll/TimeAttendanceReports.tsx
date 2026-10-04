import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useEmployees } from '@/hooks/useEmployees';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { useTimeAttendance } from '@/hooks/useTimeAttendance';
import { REPORT_CATALOG, auditTrailForPayroll, runReport, type AttendanceReportId } from '@/lib/timeAttendance/engine';
import type { AttendanceStatus } from '@/lib/timeAttendance/types';

const PRESETS = [
  'Today', 'Yesterday', 'This Week', 'Last Week', 'This Month', 'Last Month',
  'This Quarter', 'Last Quarter', 'This Year', 'Last Year', 'Custom',
] as const;

function iso(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function startOfWeek(date: Date): Date {
  const copy = new Date(date);
  const day = copy.getDay();
  copy.setDate(copy.getDate() - ((day + 6) % 7));
  return copy;
}

export function dateRangeFor(preset: (typeof PRESETS)[number], today = new Date()): { start: string; end: string } {
  const day = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (preset === 'Today') return { start: iso(day), end: iso(day) };
  if (preset === 'Yesterday') {
    const previous = new Date(day);
    previous.setDate(day.getDate() - 1);
    return { start: iso(previous), end: iso(previous) };
  }
  if (preset === 'This Week') {
    const start = startOfWeek(day);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { start: iso(start), end: iso(end) };
  }
  if (preset === 'Last Week') {
    const start = startOfWeek(day);
    start.setDate(start.getDate() - 7);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { start: iso(start), end: iso(end) };
  }
  if (preset === 'This Month') {
    return { start: iso(new Date(day.getFullYear(), day.getMonth(), 1)), end: iso(new Date(day.getFullYear(), day.getMonth() + 1, 0)) };
  }
  if (preset === 'Last Month') {
    return { start: iso(new Date(day.getFullYear(), day.getMonth() - 1, 1)), end: iso(new Date(day.getFullYear(), day.getMonth(), 0)) };
  }
  if (preset === 'This Quarter') {
    const quarter = Math.floor(day.getMonth() / 3);
    return { start: iso(new Date(day.getFullYear(), quarter * 3, 1)), end: iso(new Date(day.getFullYear(), quarter * 3 + 3, 0)) };
  }
  if (preset === 'Last Quarter') {
    const quarter = Math.floor(day.getMonth() / 3) - 1;
    const year = quarter < 0 ? day.getFullYear() - 1 : day.getFullYear();
    const month = ((quarter + 4) % 4) * 3;
    return { start: iso(new Date(year, month, 1)), end: iso(new Date(year, month + 3, 0)) };
  }
  if (preset === 'This Year') return { start: `${day.getFullYear()}-01-01`, end: `${day.getFullYear()}-12-31` };
  if (preset === 'Last Year') return { start: `${day.getFullYear() - 1}-01-01`, end: `${day.getFullYear() - 1}-12-31` };
  return { start: iso(day), end: iso(day) };
}

export default function TimeAttendanceReports() {
  const [params, setParams] = useSearchParams();
  const requested = params.get('report') as AttendanceReportId | null;
  const report = REPORT_CATALOG.some((item) => item.id === requested) ? requested! : 'employee-hours';
  const { organization } = useCurrentOrganization();
  const { org } = useTimeAttendance(organization?.id);
  const { employees } = useEmployees();
  const initial = dateRangeFor('This Month');
  const [preset, setPreset] = useState<(typeof PRESETS)[number]>('This Month');
  const [start, setStart] = useState(initial.start);
  const [end, setEnd] = useState(initial.end);
  const [department, setDepartment] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [employeeType, setEmployeeType] = useState('');
  const [managerId, setManagerId] = useState('');
  const [division, setDivision] = useState('');
  const [location, setLocation] = useState('');
  const [status, setStatus] = useState<AttendanceStatus | ''>('');
  const [payrollRunId, setPayrollRunId] = useState('');

  function applyPreset(next: (typeof PRESETS)[number]) {
    setPreset(next);
    if (next !== 'Custom') {
      const range = dateRangeFor(next);
      setStart(range.start);
      setEnd(range.end);
    }
  }

  const allowedIds = useMemo(() => {
    return new Set(employees.filter((employee) => {
      if (department && employee.department !== department) return false;
      if (employeeId && employee.id !== employeeId) return false;
      if (employeeType && employee.employment_type !== employeeType) return false;
      if (managerId && employee.manager_id !== managerId) return false;
      if (division && employee.cost_centre !== division) return false;
      if (location && employee.city !== location) return false;
      return true;
    }).map((employee) => employee.id));
  }, [employees, department, employeeId, employeeType, managerId, division, location]);

  const rows = useMemo(() => {
    if (!org) return [];
    return runReport(org, report, {
      periodStart: start,
      periodEnd: end,
      department: department || undefined,
      employeeId: employeeId || undefined,
      status,
      today: end,
    }).filter((row) => allowedIds.has(row.employeeId));
  }, [org, report, start, end, department, employeeId, status, allowedIds]);

  const totals = rows.reduce(
    (sum, row) => ({
      regular: sum.regular + row.regularHours,
      overtime: sum.overtime + row.overtimeHours,
      paid: sum.paid + row.paidHours,
    }),
    { regular: 0, overtime: 0, paid: 0 },
  );
  const trail = org && payrollRunId && employeeId ? auditTrailForPayroll(org, payrollRunId, employeeId) : null;
  const departments = Array.from(new Set(employees.map((employee) => employee.department).filter(Boolean))) as string[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Time & Attendance reports</h1>
        <p className="text-sm text-muted-foreground">{organization?.name ?? 'Company'} · {REPORT_CATALOG.find((item) => item.id === report)?.description}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {REPORT_CATALOG.map((item) => (
          <button
            key={item.id}
            className={`rounded-md border px-3 py-1 text-sm ${item.id === report ? 'bg-primary text-primary-foreground' : ''}`}
            onClick={() => setParams({ report: item.id })}
          >
            {item.name}
          </button>
        ))}
      </div>

      <Card className="grid gap-3 p-4 md:grid-cols-4">
        <label className="text-sm">Date range
          <select className="mt-1 h-9 w-full rounded-md border bg-background px-2" value={preset} onChange={(event) => applyPreset(event.target.value as (typeof PRESETS)[number])}>
            {PRESETS.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label className="text-sm">From
          <input className="mt-1 h-9 w-full rounded-md border bg-background px-2" type="date" value={start} onChange={(event) => { setPreset('Custom'); setStart(event.target.value); }} />
        </label>
        <label className="text-sm">To
          <input className="mt-1 h-9 w-full rounded-md border bg-background px-2" type="date" value={end} onChange={(event) => { setPreset('Custom'); setEnd(event.target.value); }} />
        </label>
        <label className="text-sm">Status
          <select className="mt-1 h-9 w-full rounded-md border bg-background px-2" value={status} onChange={(event) => setStatus(event.target.value as AttendanceStatus | '')}>
            <option value="">All</option>
            {['OPEN', 'COMPLETED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'ADJUSTED', 'LOCKED', 'EXPORTED_TO_PAYROLL'].map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label className="text-sm">Department
          <select className="mt-1 h-9 w-full rounded-md border bg-background px-2" value={department} onChange={(event) => setDepartment(event.target.value)}>
            <option value="">All</option>
            {departments.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label className="text-sm">Employee
          <select className="mt-1 h-9 w-full rounded-md border bg-background px-2" value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}>
            <option value="">All</option>
            {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.first_name} {employee.last_name}</option>)}
          </select>
        </label>
        <label className="text-sm">Employee type
          <select className="mt-1 h-9 w-full rounded-md border bg-background px-2" value={employeeType} onChange={(event) => setEmployeeType(event.target.value)}>
            <option value="">All</option>
            <option value="full_time">Full-time</option>
            <option value="part_time">Part-time</option>
            <option value="contract">Contract</option>
            <option value="temporary">Temporary</option>
          </select>
        </label>
        <label className="text-sm">Manager
          <select className="mt-1 h-9 w-full rounded-md border bg-background px-2" value={managerId} onChange={(event) => setManagerId(event.target.value)}>
            <option value="">All</option>
            {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.first_name} {employee.last_name}</option>)}
          </select>
        </label>
        <label className="text-sm">Division
          <input className="mt-1 h-9 w-full rounded-md border bg-background px-2" value={division} placeholder="Cost centre" onChange={(event) => setDivision(event.target.value)} />
        </label>
        <label className="text-sm">Location
          <input className="mt-1 h-9 w-full rounded-md border bg-background px-2" value={location} placeholder="City" onChange={(event) => setLocation(event.target.value)} />
        </label>
        <label className="text-sm md:col-span-2">Pay run for audit trail
          <input className="mt-1 h-9 w-full rounded-md border bg-background px-2" value={payrollRunId} placeholder="Payroll run id" onChange={(event) => setPayrollRunId(event.target.value)} />
        </label>
      </Card>

      {!org?.company.enabled && (
        <p className="text-sm text-muted-foreground">Time tracking is off, so these reports stay empty and payroll is unchanged.</p>
      )}

      <Card className="overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Employee</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Clock in</TableHead>
              <TableHead>Clock out</TableHead>
              <TableHead>Break</TableHead>
              <TableHead>Regular</TableHead>
              <TableHead>OT</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.workDate}</TableCell>
                <TableCell>{row.employeeName}</TableCell>
                <TableCell>{row.department}</TableCell>
                <TableCell>{row.clockIn}</TableCell>
                <TableCell>{row.clockOut}</TableCell>
                <TableCell>{row.breakMinutes}</TableCell>
                <TableCell>{row.regularHours.toFixed(2)}</TableCell>
                <TableCell>{row.overtimeHours.toFixed(2)}</TableCell>
                <TableCell>{row.status}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      <p className="text-sm">Regular hours: {totals.regular.toFixed(2)} · Overtime: {totals.overtime.toFixed(2)} · Total paid hours: {totals.paid.toFixed(2)}</p>

      {trail && (
        <Card className="space-y-2 p-4 text-sm">
          <p className="font-medium">Payroll run {payrollRunId}</p>
          <p>Regular {trail.summary.regularHours.toFixed(2)} · Overtime {trail.summary.overtimeHours.toFixed(2)} · Holiday {trail.summary.holidayHours.toFixed(2)}</p>
          {trail.summary.daily.map((day) => (
            <p key={day.entryId}>{day.workDate} · regular {day.regularHours.toFixed(2)} · overtime {day.overtimeHours.toFixed(2)}</p>
          ))}
          {trail.adjustments.map((item) => (
            <p key={item.id}>Adjustment {item.fieldName}: {item.originalValue} → {item.newValue} · {item.reason} · {item.adjustedBy}</p>
          ))}
        </Card>
      )}
    </div>
  );
}
