import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useOrganizationContext } from '@/hooks/useOrganizationContext';
import { useTreasuryJobs } from '@/hooks/useTreasuryJobs';
import { formatDistanceToNow } from 'date-fns';

export default function TreasuryJobsLog() {
  const { currentOrganization } = useOrganizationContext();
  const { data: jobs = [], isLoading } = useTreasuryJobs(currentOrganization?.id);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Treasury Jobs Log</h1>
        <p className="text-muted-foreground">Scheduled forecasts, anomaly scans, nexus checks, TIN-match batches, and consolidation runs.</p>
      </div>
      <Card>
        <CardHeader><CardTitle>Recent runs</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : jobs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No job runs recorded yet. Scheduled jobs will appear here.</p>
          ) : (
            <ul className="divide-y">
              {jobs.map((j) => (
                <li key={j.id} className="py-2 flex justify-between text-sm">
                  <div>
                    <div className="font-mono">{j.job_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(j.started_at), { addSuffix: true })}
                      {j.duration_ms ? ` · ${j.duration_ms}ms` : ''}
                    </div>
                    {j.error && <div className="text-xs text-destructive">{j.error}</div>}
                  </div>
                  <Badge variant={j.status === 'completed' ? 'default' : j.status === 'failed' ? 'destructive' : 'secondary'}>
                    {j.status}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
