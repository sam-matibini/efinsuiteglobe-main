import { Loader2, Mic, MicOff, Phone, PhoneOff } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface ReceptionCallBarProps {
  live: boolean;
  connecting?: boolean;
  muted: boolean;
  statusLabel: string;
  onToggleCall: () => void;
  onToggleMute: () => void;
}

export function ReceptionCallBar({
  live,
  connecting = false,
  muted,
  statusLabel,
  onToggleCall,
  onToggleMute,
}: ReceptionCallBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="reception-call-bar">
      <Badge variant="secondary">{statusLabel}</Badge>
      <Button
        type="button"
        size="sm"
        variant={live ? 'destructive' : 'default'}
        onClick={onToggleCall}
        aria-label={live ? 'End voice call' : 'Start voice call'}
      >
        {connecting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : live ? <PhoneOff className="mr-1 h-4 w-4" /> : <Phone className="mr-1 h-4 w-4" />}
        {live ? 'End call' : 'Start call'}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={!live}
        onClick={onToggleMute}
        aria-label={muted ? 'Unmute call' : 'Mute call'}
      >
        {muted ? <MicOff className="mr-1 h-4 w-4" /> : <Mic className="mr-1 h-4 w-4" />}
        {muted ? 'Unmute' : 'Mute'}
      </Button>
    </div>
  );
}
