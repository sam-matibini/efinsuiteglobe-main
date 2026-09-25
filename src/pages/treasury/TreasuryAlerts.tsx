import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useOrganizationContext } from '@/hooks/useOrganizationContext';
import { useTreasuryAlerts } from '@/hooks/useTreasuryAlerts';
import { Check } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const sev: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  info: 'secondary', low: 'outline', medium: 'default', high: 'destructive', critical: 'destructive',
};

export default function TreasuryAlerts() {
  const { currentOrganization } = useOrganizationContext();
  const { data: alerts = [], isLoading, ack } = useTreasuryAlerts(currentOrganization?.id);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Treasury Alerts</h1>
        <p className="text-muted-foreground">Anomalies, job failures, stale forecasts, and overdue filings.</p>
      </div>
      <Card>
        <CardHeader><CardTitle>Open alerts</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : alerts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No alerts. The health monitor will post here.</p>
          ) : (
            <ul className="divide-y">
              {alerts.map((a) => (
                <li key={a.id} className="py-3 flex justify-between items-start gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant={sev[a.severity] ?? 'secondary'}>{a.severity}</Badge>
                      <span className="text-xs text-muted-foreground">{a.category}</span>
                      <span className="text-xs text-muted-foreground">· {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}</span>
                    </div>
                    <div className="font-medium mt-1">{a.title}</div>
                    {a.body && <div className="text-sm text-muted-foreground">{a.body}</div>}
                  </div>
                  {a.ack_at ? (
                    <Badge variant="outline">Acknowledged</Badge>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => ack.mutate(a.id)}>
                      <Check className="h-3 w-3 mr-1" />Ack
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
