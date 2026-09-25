import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useCraAuditLog } from '@/hooks/useCraAuditLog';
import { Download, Shield } from 'lucide-react';

function toCsv(rows: Record<string, unknown>[]) {
  if (!rows.length) return '';
  const cols = ['created_at', 'action', 'tax_payment_id', 'actor_user_id', 'ip_address', 'payload'];
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(c === 'payload' ? JSON.stringify(r[c] ?? {}) : r[c])).join(','))].join('\n');
}

export default function CraAuditLog() {
  const { data: entries = [], isLoading } = useCraAuditLog({ limit: 500 });

  const download = () => {
    const csv = toCsv(entries as unknown as Record<string, unknown>[]);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `cra-audit-log-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><Shield className="h-7 w-7" /> CRA Audit Log</h1>
          <p className="text-muted-foreground">Immutable FINTRAC-style log of every CRA remittance event.</p>
        </div>
        <Button variant="outline" onClick={download} disabled={!entries.length}>
          <Download className="mr-2 h-4 w-4" /> Export CSV
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Recent events ({entries.length})</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No audit events yet.</p>
          ) : (
            <div className="rounded-md border divide-y text-sm max-h-[600px] overflow-y-auto">
              {entries.map((e) => (
                <div key={e.id} className="grid grid-cols-12 gap-2 px-3 py-2">
                  <div className="col-span-2 font-mono text-xs text-muted-foreground">{new Date(e.created_at).toLocaleString()}</div>
                  <div className="col-span-3"><Badge variant="outline">{e.action}</Badge></div>
                  <div className="col-span-3 font-mono text-xs">{e.tax_payment_id ? e.tax_payment_id.slice(0, 8) : '—'}</div>
                  <div className="col-span-2 font-mono text-xs">{e.actor_user_id ? e.actor_user_id.slice(0, 8) : 'system'}</div>
                  <div className="col-span-2 text-xs text-muted-foreground truncate" title={JSON.stringify(e.payload)}>{JSON.stringify(e.payload)}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
