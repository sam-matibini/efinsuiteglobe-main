import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Loader2, RefreshCw, CheckCircle2, XCircle, Eye } from 'lucide-react';
import { useTreasuryAnomalies, type TreasuryAnomaly, type AnomalyStatus } from '@/hooks/useTreasuryAnomalies';

const CATEGORY_LABEL: Record<string, string> = {
  period_swing: 'Period-over-period swing',
  missed_period: 'Missed period',
  duplicate_payment: 'Duplicate payment',
  low_match_score: 'Low reconciliation match',
  other: 'Other',
};

const SEVERITY_TONE: Record<string, string> = {
  low: 'bg-muted text-muted-foreground',
  medium: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  high: 'bg-orange-500/10 text-orange-700 dark:text-orange-300',
  critical: 'bg-destructive/10 text-destructive',
};

export default function AnomalyInbox() {
  const [tab, setTab] = useState<AnomalyStatus>('open');
  const { anomalies, isLoading, scan, updateStatus } = useTreasuryAnomalies({ status: tab });

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Anomaly Inbox</h1>
          <p className="text-muted-foreground">Missed remittances, duplicates, and unusual swings detected across CRA and provincial activity.</p>
        </div>
        <Button onClick={() => scan.mutate()} disabled={scan.isPending}>
          {scan.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Run scan
        </Button>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as AnomalyStatus)}>
        <TabsList>
          <TabsTrigger value="open">Open</TabsTrigger>
          <TabsTrigger value="acknowledged">Acknowledged</TabsTrigger>
          <TabsTrigger value="resolved">Resolved</TabsTrigger>
          <TabsTrigger value="dismissed">Dismissed</TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="pt-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : anomalies.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">No anomalies in this bucket.</CardContent></Card>
          ) : (
            <div className="space-y-3">
              {anomalies.map((a) => (
                <AnomalyRow key={a.id} anomaly={a}
                  onAck={() => updateStatus.mutate({ id: a.id, status: 'acknowledged' })}
                  onResolve={() => updateStatus.mutate({ id: a.id, status: 'resolved' })}
                  onDismiss={() => updateStatus.mutate({ id: a.id, status: 'dismissed' })}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AnomalyRow({ anomaly, onAck, onResolve, onDismiss }: {
  anomaly: TreasuryAnomaly;
  onAck: () => void;
  onResolve: () => void;
  onDismiss: () => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <Badge className={SEVERITY_TONE[anomaly.severity]}>{anomaly.severity}</Badge>
            <span>{CATEGORY_LABEL[anomaly.category] ?? anomaly.category}</span>
            {anomaly.authority && <span className="text-sm text-muted-foreground">· {anomaly.authority}</span>}
            {anomaly.program_code && <span className="text-sm text-muted-foreground">· {anomaly.program_code}</span>}
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">{new Date(anomaly.created_at).toLocaleString()}</p>
        </div>
        {anomaly.status === 'open' && (
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={onAck}><Eye className="mr-1 h-3 w-3" />Acknowledge</Button>
            <Button size="sm" variant="outline" onClick={onResolve}><CheckCircle2 className="mr-1 h-3 w-3" />Resolve</Button>
            <Button size="sm" variant="ghost" onClick={onDismiss}><XCircle className="mr-1 h-3 w-3" />Dismiss</Button>
          </div>
        )}
      </CardHeader>
      <CardContent>
        <pre className="text-xs bg-muted/50 rounded p-2 overflow-x-auto">{JSON.stringify(anomaly.payload, null, 2)}</pre>
      </CardContent>
    </Card>
  );
}
