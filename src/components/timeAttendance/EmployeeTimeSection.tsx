import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAttendanceActor } from '@/hooks/useAttendanceActor';
import { useTimeAttendance } from '@/hooks/useTimeAttendance';
import { defaultEmployeeSettings, inferPayType, resolveTracking, scheduleLabel } from '@/lib/timeAttendance/engine';
import type { DaySchedule, EmployeeTimeSettings, Weekday } from '@/lib/timeAttendance/types';
import { WEEKDAYS } from '@/lib/timeAttendance/types';

interface EmployeeTimeSectionProps {
  employee: {
    id: string;
    organization_id: string | null;
    first_name: string;
    last_name: string;
    employee_number: string;
    department: string | null;
    job_title: string | null;
    pay_frequency: string | null;
    annual_salary: number | null;
    hourly_rate: number | null;
  };
}

export function EmployeeTimeSection({ employee }: EmployeeTimeSectionProps) {
  const actor = useAttendanceActor(employee.id);
  const { org, send } = useTimeAttendance(employee.organization_id, actor);
  const payType = inferPayType(employee);
  const saved = org?.employees[employee.id];
  const [draft, setDraft] = useState<EmployeeTimeSettings | null>(saved ?? null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!org) return;
    setDraft(saved ?? defaultEmployeeSettings(org.company, employee.id, payType));
  }, [saved, org, employee.id, payType]);

  if (!org || !draft || !employee.organization_id) return null;

  const trackingOn = resolveTracking(org.company, draft, payType);
  const today = new Date().toISOString().slice(0, 10);

  function dayRow(day: Weekday): DaySchedule {
    return draft!.schedule.find((row) => row.day === day) ?? { day, start: '', end: '' };
  }

  function updateDay(day: Weekday, patch: Partial<DaySchedule>) {
    setDraft((current) => {
      if (!current) return current;
      const existing = current.schedule.find((row) => row.day === day) ?? { day, start: '', end: '' };
      const next = { ...existing, ...patch };
      const schedule = current.schedule.some((row) => row.day === day)
        ? current.schedule.map((row) => (row.day === day ? next : row))
        : [...current.schedule, next];
      return { ...current, schedule };
    });
  }

  async function save() {
    if (!draft) return;
    setBusy(true);
    try {
      const schedule = draft.schedule.filter((row) => row.start && row.end);
      await send('PUT', '/api/time/employee-settings', { settings: { ...draft, payType, schedule } });
      toast.success('Time & Attendance settings saved');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save time settings');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-6 p-6">
      <div>
        <h3 className="text-lg font-semibold">Employment</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-3 text-sm">
          <Field label="Employee ID" value={employee.employee_number} />
          <Field label="Department" value={employee.department || '—'} />
          <Field label="Position" value={employee.job_title || '—'} />
          <Field label="Pay Frequency" value={employee.pay_frequency?.replace('_', '-') || '—'} />
          <Field label="Pay Type" value={payType === 'salary' ? 'Salary' : 'Hourly'} />
        </div>
      </div>
      <div>
        <h3 className="text-lg font-semibold">Time & Attendance</h3>
        {!org.company.enabled && (
          <p className="mt-2 text-sm text-muted-foreground">
            Time tracking is off for this company. Payroll continues with this employee’s salary or hours.
          </p>
        )}
        <div className="mt-4 grid gap-4 md:grid-cols-2 text-sm">
          <label className="space-y-1">
            <span className="text-muted-foreground">Time Tracking</span>
            <select
              className="mt-1 h-9 w-full rounded-md border bg-background px-2"
              value={draft.enabled === null ? 'inherit' : draft.enabled ? 'on' : 'off'}
              onChange={(event) => {
                const value = event.target.value;
                setDraft({ ...draft, enabled: value === 'inherit' ? null : value === 'on' });
              }}
            >
              <option value="inherit">Inherit company ({payType === 'salary' ? 'off for salary' : org.company.enabled ? 'on' : 'off'})</option>
              <option value="on">On</option>
              <option value="off">Off</option>
            </select>
          </label>
          <p className="self-end">Effective tracking: {trackingOn ? 'ON' : 'OFF'}</p>
          <Check label="Clock-In Required" checked={draft.clockInRequired} onChange={(clockInRequired) => setDraft({ ...draft, clockInRequired })} />
          <Check label="Clock-Out Required" checked={draft.clockOutRequired} onChange={(clockOutRequired) => setDraft({ ...draft, clockOutRequired })} />
        </div>
        <div className="mt-4 space-y-2">
          <p className="text-sm font-medium">Scheduled Hours</p>
          <p className="text-sm text-muted-foreground">Today: {scheduleLabel(draft.schedule, today)}</p>
          {WEEKDAYS.map((day) => {
            const row = dayRow(day);
            return (
              <div key={day} className="grid grid-cols-[120px_1fr_1fr] items-center gap-2 text-sm capitalize">
                <span>{day}</span>
                <Input type="time" value={row.start} onChange={(event) => updateDay(day, { start: event.target.value })} />
                <Input type="time" value={row.end} onChange={(event) => updateDay(day, { end: event.target.value })} />
              </div>
            );
          })}
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="text-sm">
            Break minutes
            <Input
              type="number"
              min={0}
              className="mt-1"
              value={draft.breakMinutes}
              onChange={(event) => setDraft({ ...draft, breakMinutes: Number(event.target.value) || 0 })}
            />
          </label>
          <label className="text-sm">
            Overtime Rule
            <select
              className="mt-1 h-9 w-full rounded-md border bg-background px-2"
              value={draft.overtimeRule}
              onChange={(event) => setDraft({ ...draft, overtimeRule: event.target.value as EmployeeTimeSettings['overtimeRule'] })}
            >
              <option value="company_default">Company Default</option>
              <option value="none">None</option>
            </select>
          </label>
        </div>
        <Button className="mt-4" disabled={busy} onClick={save}>Save time settings</Button>
      </div>
    </Card>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p className="font-medium capitalize">{value}</p>
    </div>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex items-center gap-2">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      {label}: {checked ? 'YES' : 'NO'}
    </label>
  );
}
