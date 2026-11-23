import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatElapsed } from '@/lib/timeAttendance/engine';

interface ClockWidgetProps {
  dateLabel: string;
  scheduleLabel: string;
  clockedIn: boolean;
  clockInLabel?: string;
  elapsedMinutes?: number;
  onBreak?: boolean;
  breakLabel?: string;
  onClockIn: () => void;
  onClockOut: () => void;
  onStartBreak: () => void;
  onEndBreak: () => void;
  showBreak: boolean;
  busy?: boolean;
  error?: string | null;
}

export function ClockWidget({
  dateLabel,
  scheduleLabel,
  clockedIn,
  clockInLabel,
  elapsedMinutes = 0,
  onBreak,
  breakLabel,
  onClockIn,
  onClockOut,
  onStartBreak,
  onEndBreak,
  showBreak,
  busy,
  error,
}: ClockWidgetProps) {
  return (
    <Card data-testid="time-attendance-widget">
      <CardHeader className="pb-2">
        <CardTitle className="text-center tracking-wide">TIME & ATTENDANCE</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-3 pb-8 text-center">
        <div>
          <p className="text-sm text-muted-foreground">Today</p>
          <p className="text-lg font-medium">{dateLabel}</p>
        </div>
        {!clockedIn ? (
          <>
            <p className="text-sm">Scheduled: {scheduleLabel}</p>
            <Button size="lg" className="mt-2 h-14 w-56 text-lg" disabled={busy} onClick={onClockIn}>
              CLOCK IN
            </Button>
            <p className="text-sm text-muted-foreground">Status: Not Clocked In</p>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">Clocked In</p>
            <p className="text-2xl font-semibold">{clockInLabel}</p>
            <p>Elapsed: {formatElapsed(elapsedMinutes)}</p>
            {onBreak && <p className="text-sm">Break started: {breakLabel}</p>}
            <Button size="lg" variant="destructive" className="mt-2 h-14 w-56 text-lg" disabled={busy} onClick={onClockOut}>
              CLOCK OUT
            </Button>
            {showBreak && (
              <Button variant="outline" disabled={busy} onClick={onBreak ? onEndBreak : onStartBreak}>
                {onBreak ? 'End Break' : 'Start Break'}
              </Button>
            )}
          </>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
