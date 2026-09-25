import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Download, FileText, AlertTriangle, History, Package } from 'lucide-react';
import { useAuditorPortal } from '@/hooks/useAuditorPortal';
import { useTreasuryAnomalies } from '@/hooks/useTreasuryAnomalies';
import { useCraFilings } from '@/hooks/useCraFilings';
import { useCraAuditLog } from '@/hooks/useCraAuditLog';
import { useAuditorExports } from '@/hooks/useAuditorExports';
import { useOrganizationContext } from '@/hooks/useOrganizationContext';

export default function AuditorPortal() {
  const { currentOrganization } = useOrganizationContext();
  const { sessions, requestAccess } = useAuditorPortal();
  const { anomalies } = useTreasuryAnomalies();
  const { filings, downloadXml } = useCraFilings();
  const { data: auditLog = [] } = useCraAuditLog({ limit: 100 });
  const { data: exports = [], generate, download } = useAuditorExports(currentOrganization?.id);
  const [periodStart, setPeriodStart] = useState(() => new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10));
  const [periodEnd, setPeriodEnd] = useState(() => new Date().toISOString().slice(0, 10));

  const [downloading, setDownloading] = useState<string | null>(null);

  async function downloadFiling(id: string) {
    const f = filings.find((x) => x.id === id);
    if (!f) return;
    setDownloading(id);
    try { await downloadXml(f); } finally { setDownloading(null); }
  }

  async function requestEvidence() {
    setDownloading('evidence');
    try {
      const res = await requestAccess.mutateAsync({ scope: 'evidence' });
      if (res?.signed_url) window.open(res.signed_url, '_blank', 'noopener,noreferrer');
    } finally { setDownloading(null); }
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Auditor Portal</h1>
        <p className="text-muted-foreground">Read-only access to SOC-2 evidence, CRA filings, anomalies, and the audit log under your active delegation.</p>
      </div>

      <Tabs defaultValue="evidence">
        <TabsList>
          <TabsTrigger value="evidence"><FileText className="h-4 w-4 mr-1" />Evidence</TabsTrigger>
          <TabsTrigger value="bundles"><Package className="h-4 w-4 mr-1" />Export bundles</TabsTrigger>
          <TabsTrigger value="filings"><Download className="h-4 w-4 mr-1" />Filings</TabsTrigger>
          <TabsTrigger value="anomalies"><AlertTriangle className="h-4 w-4 mr-1" />Anomalies ({anomalies.length})</TabsTrigger>
          <TabsTrigger value="audit"><History className="h-4 w-4 mr-1" />Audit log</TabsTrigger>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
        </TabsList>

        <TabsContent value="evidence" className="pt-4">
          <Card>
            <CardHeader><CardTitle>Compliance evidence pack</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Request a signed URL for the most recent SOC-2 evidence bundle. Links expire after 30 days.
              </p>
              <Button size="sm" onClick={requestEvidence} disabled={downloading === 'evidence'}>
                <Download className="h-3 w-3 mr-1" />Request evidence pack
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bundles" className="pt-4">
          <Card>
            <CardHeader><CardTitle>Period export bundle (ZIP)</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Generates a ZIP containing journal entries, GL detail, and anomaly history for the selected period.
              </p>
              <div className="flex gap-2 items-end">
                <div>
                  <label className="text-xs text-muted-foreground">Period start</label>
                  <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Period end</label>
                  <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
                </div>
                <Button
                  size="sm"
                  disabled={!currentOrganization?.id || generate.isPending}
                  onClick={() => generate.mutate({
                    organization_id: currentOrganization!.id,
                    period_start: periodStart,
                    period_end: periodEnd,
                  })}
                >
                  <Package className="h-3 w-3 mr-1" />Generate bundle
                </Button>
              </div>
              <ul className="text-sm divide-y mt-3">
                {exports.map((e) => (
                  <li key={e.id} className="flex justify-between py-2">
                    <span>{e.period_start} → {e.period_end} · {e.status}</span>
                    {e.bundle_path && (
                      <Button size="sm" variant="outline" onClick={() => download.mutate(e.bundle_path!)}>
                        <Download className="h-3 w-3 mr-1" />Download
                      </Button>
                    )}
                  </li>
                ))}
                {exports.length === 0 && <li className="text-muted-foreground py-2">No bundles yet.</li>}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="filings" className="pt-4">
          <Card>
            <CardHeader><CardTitle>CRA XML filings</CardTitle></CardHeader>
            <CardContent>
              {filings.length === 0 ? (
                <p className="text-sm text-muted-foreground">No filings on record.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {filings.map((f) => (
                    <li key={f.id} className="flex items-center justify-between border-b py-2">
                      <span>
                        <span className="font-mono text-xs mr-2">{f.filing_type}</span>
                        {f.period_start} → {f.period_end} · {f.status}
                      </span>
                      <Button size="sm" variant="outline" onClick={() => downloadFiling(f.id)} disabled={downloading === f.id}>
                        <Download className="h-3 w-3 mr-1" />XML
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="anomalies" className="pt-4">
          <Card>
            <CardContent className="pt-4">
              {anomalies.length === 0 ? (
                <p className="text-sm text-muted-foreground">No anomalies recorded.</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {anomalies.slice(0, 50).map((a) => (
                    <li key={a.id} className="flex justify-between border-b py-1">
                      <span>{a.category} · {a.authority ?? '—'} · {a.severity}</span>
                      <span className="text-muted-foreground">{a.status}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="pt-4">
          <Card>
            <CardContent className="pt-4">
              {auditLog.length === 0 ? (
                <p className="text-sm text-muted-foreground">No audit events.</p>
              ) : (
                <ul className="space-y-1 text-xs font-mono">
                  {auditLog.slice(0, 100).map((e) => (
                    <li key={e.id} className="border-b py-1">
                      <span className="text-muted-foreground">{new Date(e.created_at).toLocaleString()}</span> · {e.action}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sessions" className="pt-4">
          <Card>
            <CardContent className="pt-4">
              {sessions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No portal sessions yet.</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {sessions.map((s) => (
                    <li key={s.id} className="flex justify-between border-b py-1">
                      <span>{new Date(s.started_at).toLocaleString()}</span>
                      <span className="text-muted-foreground">{s.actions_count} actions · {s.scopes_used.join(', ') || 'all'}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
