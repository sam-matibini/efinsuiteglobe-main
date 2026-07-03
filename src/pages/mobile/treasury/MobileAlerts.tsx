import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useOrganizationContext } from '@/hooks/useOrganizationContext';
import { useTreasuryAlerts } from '@/hooks/useTreasuryAlerts';
import { formatDistanceToNow } from 'date-fns';

const sev: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  info: 'secondary', low: 'outline', medium: 'default', high: 'destructive', critical: 'destructive',
};

export default function MobileAlerts() {
  const { currentOrganization } = useOrganizationContext();
  const { data: alerts = [], ack, isLoading } = useTreasuryAlerts(currentOrganization?.id);

  return (
    <div className="p-4 space-y-3">
      <h2 className="font-semibold text-lg">Alerts</h2>
      {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> :
        alerts.length === 0 ? <p className="text-sm text-muted-foreground">No alerts.</p> :
        alerts.map((a) => (
          <Card key={a.id}><CardContent className="p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant={sev[a.severity] ?? 'secondary'}>{a.severity}</Badge>
              <span className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}</span>
            </div>
            <div className="font-medium text-sm">{a.title}</div>
            {a.body && <div className="text-xs text-muted-foreground">{a.body}</div>}
            {!a.ack_at && <Button size="sm" variant="outline" className="w-full" onClick={() => ack.mutate(a.id)}>Acknowledge</Button>}
          </CardContent></Card>
        ))}
    </div>
  );
}
