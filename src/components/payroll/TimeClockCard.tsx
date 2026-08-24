import { useEffect, useState } from 'react';
import {
  Clock,
  Play,
  Square,
  Coffee,
  Send,
  LogIn,
  LogOut,
  Timer,
} from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { useTimeClock, type EmployeeLite } from '@/hooks/useTimeClock';
import { formatDuration, formatTime } from '@/lib/timeClock';
import type { TimesheetStatus } from '@/hooks/useTimesheets';

const timesheetStatusConfig: Record<TimesheetStatus, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-muted text-muted-foreground' },
  submitted: { label: 'Submitted', className: 'bg-blue-500/10 text-blue-600' },
  approved: { label: 'Approved', className: 'bg-success/10 text-success' },
  rejected: { label: 'Rejected', className: 'bg-destructive/10 text-destructive' },
  processed: { label: 'Processed', className: 'bg-primary/10 text-primary' },
};

function pad(n: number) {
  return String(n).padStart(2, '0');
}

interface TimeClockCardProps {
  employee: EmployeeLite;
  submitTimesheet: {
    mutate: (timesheetId: string) => void;
    isPending: boolean;
  };
}

export function TimeClockCard({ employee, submitTimesheet }: TimeClockCardProps) {
  const {
    openPunch,
    openBreak,
    todayPunches,
    summary,
    periodTimesheet,
    isLoading,
    clockIn,
    startBreak,
    endBreak,
    clockOut,
  } = useTimeClock(employee);

  const [now, setNow] = useState(() => Date.now());
  const [clockOutOpen, setClockOutOpen] = useState(false);
  const [note, setNote] = useState('');

  const onShift = !!openPunch;
  const canSubmit =
    !!periodTimesheet && ['draft', 'rejected'].includes(periodTimesheet.status);

  useEffect(() => {
    if (!onShift) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [onShift]);

  const runningBreakMs = openBreak ? now - new Date(openBreak.break_start_at).getTime() : 0;
  const elapsedMs = openPunch
    ? Math.max(now - new Date(openPunch.clock_in_at).getTime() - runningBreakMs - (openPunch.break_minutes ?? 0) * 60000, 0)
    : 0;

  const handleClockOut = () => {
    clockOut(note);
    setNote('');
    setClockOutOpen(false);
  };

  const statusInfo = periodTimesheet
    ? timesheetStatusConfig[periodTimesheet.status]
    : null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Timer className="w-5 h-5" />
          Time Clock
        </CardTitle>
        {statusInfo && (
          <Badge variant="outline" className={cn('gap-1', statusInfo.className)}>
            Timesheet: {statusInfo.label}
          </Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Punch controls */}
        <div
          className={cn(
            'rounded-lg border p-6 flex flex-col items-center justify-center gap-3',
            onShift && 'bg-primary/5 border-primary/20',
          )}
        >
          {isLoading ? (
            <div className="h-24 flex items-center text-sm text-muted-foreground">
              Loading time clock...
            </div>
          ) : !onShift ? (
            <>
              <p className="text-sm text-muted-foreground">You are not on shift</p>
              <Button
                size="lg"
                className="w-56 h-14 text-lg gap-2"
                onClick={() => clockIn()}
              >
                <LogIn className="w-5 h-5" />
                Clock In
              </Button>
            </>
          ) : (
            <>
              {openBreak ? (
                <Badge className="gap-1 bg-warning/10 text-warning border-warning/30">
                  <Coffee className="w-3 h-3" />
                  On break · {formatDuration(runningBreakMs / 60000)}
                </Badge>
              ) : (
                <p className="text-sm text-muted-foreground">
                  On shift since {formatTime(openPunch!.clock_in_at)}
                </p>
              )}
              <div className="font-mono text-4xl font-bold tabular-nums tracking-tight">
                {pad(Math.floor(elapsedMs / 3600000))}:{pad(Math.floor(elapsedMs / 60000) % 60)}:
                {pad(Math.floor(elapsedMs / 1000) % 60)}
              </div>
              <div className="flex gap-2 mt-1">
                {openBreak ? (
                  <Button variant="outline" onClick={() => endBreak()}>
                    <Play className="w-4 h-4 mr-2" />
                    End Break
                  </Button>
                ) : (
                  <Button variant="outline" onClick={() => startBreak()}>
                    <Coffee className="w-4 h-4 mr-2" />
                    Start Break
                  </Button>
                )}
                <Button
                  variant="destructive"
                  onClick={() => setClockOutOpen(true)}
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Clock Out
                </Button>
              </div>
            </>
          )}
        </div>

        {/* This pay period */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Regular hours</p>
            <p className="text-xl font-bold">{summary.regularHours.toFixed(2)}h</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Overtime hours</p>
            <p className="text-xl font-bold text-warning">{summary.overtimeHours.toFixed(2)}h</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Total this period</p>
            <p className="text-xl font-bold">{summary.totalHours.toFixed(2)}h</p>
          </div>
          <div className="rounded-lg border p-3 flex flex-col justify-between gap-2">
            <p className="text-xs text-muted-foreground">Timesheet</p>
            {canSubmit ? (
              <Button
                size="sm"
                className="w-full"
                disabled={submitTimesheet.isPending || !periodTimesheet}
                onClick={() => periodTimesheet && submitTimesheet.mutate(periodTimesheet.id)}
              >
                <Send className="w-3 h-3 mr-1" />
                Submit for approval
              </Button>
            ) : (
              <p className="text-sm font-medium">
                {periodTimesheet
                  ? timesheetStatusConfig[periodTimesheet.status].label
                  : 'Not started'}
              </p>
            )}
          </div>
        </div>

        {/* Today's punches */}
        <div>
          <h3 className="text-sm font-medium mb-2">Today's punches</h3>
          {todayPunches.length === 0 ? (
            <p className="text-sm text-muted-foreground py-3 text-center rounded-lg border border-dashed">
              No punches recorded today yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Clock in</TableHead>
                  <TableHead>Clock out</TableHead>
                  <TableHead>Break</TableHead>
                  <TableHead className="text-right">Net hours</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {todayPunches.map((punch) => {
                  const isLive = punch.status === 'open';
                  const netHours = isLive
                    ? `${(Math.max((now - new Date(punch.clock_in_at).getTime()) / 3600000 - (punch.break_minutes ?? 0), 0)).toFixed(2)}h`
                    : punch.total_hours != null
                      ? `${punch.total_hours.toFixed(2)}h`
                      : '-';
                  return (
                    <TableRow key={punch.id}>
                      <TableCell>{formatTime(punch.clock_in_at)}</TableCell>
                      <TableCell>
                        {punch.clock_out_at ? (
                          formatTime(punch.clock_out_at)
                        ) : (
                          <Badge variant="outline" className="gap-1 bg-primary/10 text-primary">
                            <Square className="w-3 h-3" />
                            Running
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{formatDuration(punch.break_minutes ?? 0)}</TableCell>
                      <TableCell className="text-right font-mono">{netHours}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </CardContent>

      {/* Clock out dialog */}
      <Dialog open={clockOutOpen} onOpenChange={setClockOutOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Clock Out
            </DialogTitle>
            <DialogDescription>
              Shift started at {openPunch ? format(new Date(openPunch.clock_in_at), 'h:mm a') : '-'}. Add an optional note for your supervisor.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Forgot to take a lunch break, worked through..."
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setClockOutOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleClockOut}>
              <LogOut className="w-4 h-4 mr-2" />
              Clock Out
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
