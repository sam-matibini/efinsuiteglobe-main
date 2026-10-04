import { Phone } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ReceptionCallBar } from '@/components/receptionist/ReceptionCallBar';
import type { ReceptionCall } from '@/lib/receptionist/types';

function when(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-CA', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date);
}

interface ReceptionCallsPanelProps {
  enabled: boolean;
  live: boolean;
  connecting?: boolean;
  muted: boolean;
  statusLabel: string;
  calls: ReceptionCall[];
  onEnabledChange: (enabled: boolean) => void;
  onToggleCall: () => void;
  onToggleMute: () => void;
}

export function ReceptionCallsPanel({
  enabled,
  live,
  connecting,
  muted,
  statusLabel,
  calls,
  onEnabledChange,
  onToggleCall,
  onToggleMute,
}: ReceptionCallsPanelProps) {
  return (
    <div className="space-y-3">
      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-primary" />
            <h2 className="font-medium">Calls</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            ElevenLabs answers on a live call, listens, speaks, and can end or transfer it. Text calls are recorded when voice is not connected.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Label htmlFor="receptionist-calls-enabled" className="text-sm">Enable calls</Label>
          <Switch id="receptionist-calls-enabled" checked={enabled} onCheckedChange={onEnabledChange} aria-label="Enable calls" />
          <ReceptionCallBar
            live={live}
            connecting={connecting}
            muted={muted}
            statusLabel={statusLabel}
            onToggleCall={onToggleCall}
            onToggleMute={onToggleMute}
          />
        </div>
      </Card>
      {calls.length === 0 && <Card className="p-6 text-sm text-muted-foreground">Calls, transcripts, and summaries will appear here.</Card>}
      {calls.map((call) => (
        <Card key={call.id} className="p-4">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">{call.callerName || 'Unknown caller'}</p>
            <Badge variant="outline">{call.channel}</Badge>
            <Badge variant="secondary">{call.status.replace('_', ' ')}</Badge>
            <span className="text-xs text-muted-foreground">{when(call.startedAt)}</span>
          </div>
          <p className="mt-2 text-sm">{call.summary}</p>
          <div className="mt-3 space-y-1">
            {call.transcript.map((turn, index) => (
              <p key={index} className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{turn.role === 'caller' ? 'Caller' : 'Receptionist'}: </span>
                {turn.text}
              </p>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}
