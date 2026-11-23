import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ClockWidget } from '@/components/timeAttendance/ClockWidget';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useTimeAttendance } from '@/hooks/useTimeAttendance';
import {
  calendarDate,
  dashboardForEmployee,
  formatClock,
  formatLongDate,
  resolveTracking,
  scheduleLabel,
} from '@/lib/timeAttendance/engine';
import { currentPayPeriod } from '@/lib/timeClock';
import type { Actor, ClockOutReceipt, PayType } from '@/lib/timeAttendance/types';

interface EmployeeClockPanelProps {
  organizationId: string;
  employeeId: string;
  employeeName: string;
  department?: string | null;
  payType: PayType;
  payFrequency?: string | null;
  actor: Actor;
}

export function EmployeeClockPanel({
  organizationId,
  employeeId,
  employeeName,
  department,
  payType,
  payFrequency,
  actor,
}: EmployeeClockPanelProps) {
  const { org, send } = useTimeAttendance(organizationId, actor);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<ClockOutReceipt | null>(null);
  const [reason, setReason] = useState('');
  const [correctionId, setCorrectionId] = useState('');

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const tracked = !!org && resolveTracking(org.company, org.employees[employeeId], payType);
  const timezone = org?.company.timezone ?? 'America/Toronto';
  const today = calendarDate(new Date(now).toISOString(), timezone);
  const settings = org?.employees[employeeId];
  const open = org?.entries.find((entry) => entry.employeeId === employeeId && entry.status === 'OPEN');
  const openBreak = open?.breaks.find((span) => !span.end);
  const elapsedMinutes = open ? Math.floor((now - new Date(open.clockIn).getTime()) / 60000) : 0;
  const period = currentPayPeriod(payFrequency, today);
  const mine = useMemo(
    () => (org?.entries ?? []).filter((entry) => entry.employeeId === employeeId && entry.workDate >= period.period_start && entry.workDate <= period.period_end),
    [org?.entries, employeeId, period.period_start, period.period_end],
  );
  const todayDash = org ? dashboardForEmployee(org, employeeId, today) : null;

  if (!org || !tracked) return null;

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Time attendance request failed';
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  const totalPaid = mine.reduce((sum, entry) => sum + entry.paidHours, 0);

  return (
    <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
      <ClockWidget
        dateLabel={formatLongDate(new Date(now).toISOString(), timezone)}
        scheduleLabel={scheduleLabel(settings?.schedule, today)}
        clockedIn={!!open}
        clockInLabel={open ? formatClock(open.clockIn, timezone) : undefined}
        elapsedMinutes={elapsedMinutes}
        onBreak={!!openBreak}
        breakLabel={openBreak ? formatClock(openBreak.start, timezone) : undefined}
        showBreak={org.company.breakTrackingEnabled && org.company.breakMode !== 'automatic'}
        busy={busy}
        error={error}
        onClockIn={() => run(() => send('POST', '/api/time/clock-in', {
          employeeId,
          employeeName,
          department,
          payType,
          source: 'WEB',
        }))}
        onClockOut={() => run(async () => {
          const result = await send('POST', '/api/time/clock-out', { employeeId, payType, source: 'WEB' });
          if (result.receipt) setReceipt(result.receipt as ClockOutReceipt);
        })}
        onStartBreak={() => run(() => send('POST', '/api/time/break/start', { employeeId }))}
        onEndBreak={() => run(() => send('POST', '/api/time/break/end', { employeeId }))}
      />

      <div className="space-y-4">
        {todayDash && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Today</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-3 gap-3 text-sm">
              <Stat label="Scheduled" value={`${todayDash.scheduledHours.toFixed(2)} hrs`} />
              <Stat label="Worked" value={`${todayDash.workedHours.toFixed(2)} hrs`} />
              <Stat label="Overtime" value={`${todayDash.overtimeHours.toFixed(2)} hrs`} />
              <p className="col-span-3 text-muted-foreground">Status: {todayDash.status}</p>
            </CardContent>
          </Card>
        )}

        {receipt && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Clock-out</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p>Clock In: {formatClock(receipt.clockIn, timezone)}</p>
              <p>Clock Out: {formatClock(receipt.clockOut, timezone)}</p>
              <p>Break: {receipt.breakMinutes} min</p>
              <p>Gross Time: {receipt.grossHours.toFixed(2)} hrs</p>
              <p>Paid Hours: {receipt.paidHours.toFixed(2)} hrs</p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">My Time</CardTitle>
            <p className="text-sm text-muted-foreground">Current pay period {period.period_start} – {period.period_end}</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {mine.length === 0 && <p className="text-sm text-muted-foreground">No clock records in this pay period.</p>}
            {mine.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between gap-3 text-sm">
                <span>{entry.workDate}</span>
                <span>{entry.paidHours.toFixed(2)} hrs</span>
                <span className="text-muted-foreground">{entry.status}</span>
              </div>
            ))}
            <p className="font-medium">Total {totalPaid.toFixed(2)}</p>
            <div className="flex flex-wrap items-center gap-2">
              <select className="h-9 rounded-md border bg-background px-2 text-sm" value={correctionId} onChange={(event) => setCorrectionId(event.target.value)}>
                <option value="">Select a record</option>
                {mine.map((entry) => (
                  <option key={entry.id} value={entry.id}>{entry.workDate}</option>
                ))}
              </select>
              <Input placeholder="Reason for correction" value={reason} onChange={(event) => setReason(event.target.value)} className="max-w-xs" />
              <Button
                variant="outline"
                disabled={!correctionId || !reason.trim() || busy}
                onClick={() => run(async () => {
                  await send('POST', '/api/time/correction', { entryId: correctionId, reason });
                  setReason('');
                  toast.success('Correction requested. A manager still has to approve it.');
                })}
              >
                Request Correction
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}
