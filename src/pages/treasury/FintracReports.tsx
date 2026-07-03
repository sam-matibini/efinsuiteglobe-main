import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Download, ShieldAlert, CheckCircle2, Sparkles } from 'lucide-react';
import { useFintracReports, type FintracReport } from '@/hooks/useFintracReports';
import { useFintracReportsByKind, type FintracKind } from '@/hooks/useFintracReportsV2';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { CopilotPanel } from '@/components/settlements/CopilotPanel';

function exportCsv(rows: any[], prefix: string) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(',')];
  for (const r of rows) {
    lines.push(headers.map((h) => JSON.stringify(r[h] ?? '')).join(','));
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `fintrac-${prefix}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function FintracReports() {
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [strContextTx, setStrContextTx] = useState<string | undefined>();

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <ShieldAlert className="h-7 w-7 text-primary" />
            FINTRAC Compliance
          </h1>
          <p className="text-muted-foreground">LCTR (large cash) · EFTR (≥CAD 10,000 EFT) · STR (suspicious) · CRA EFT (legacy) — 24h aggregation, 5-year retention.</p>
        </div>
        <Button variant="outline" onClick={() => { setStrContextTx(undefined); setCopilotOpen(true); }}>
          <Sparkles className="mr-2 h-4 w-4" /> Compliance Copilot
        </Button>
      </div>

      <Tabs defaultValue="lctr" className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="lctr">LCTR (Large Cash)</TabsTrigger>
          <TabsTrigger value="eftr">EFTR (Large EFT)</TabsTrigger>
          <TabsTrigger value="str">STR (Suspicious)</TabsTrigger>
          <TabsTrigger value="legacy">CRA EFT (Legacy)</TabsTrigger>
          <TabsTrigger value="retention">Retention</TabsTrigger>
        </TabsList>

        <TabsContent value="lctr">
          <KindTab kind="lctr" title="Large Cash Transaction Reports" desc="Cash receipts aggregated ≥ CAD 10,000 in any rolling 24 hours. 15-day filing window." />
        </TabsContent>
        <TabsContent value="eftr">
          <KindTab kind="eftr" title="Electronic Funds Transfer Reports" desc="EFT in/out ≥ CAD 10,000 (including AP, AR, Treasury wires). 5-day filing window." />
        </TabsContent>
        <TabsContent value="str">
          <KindTab kind="str" title="Suspicious Transaction Reports" desc="Flagged transactions requiring officer review. 30-day filing window from detection." onDraftStr={(id) => { setStrContextTx(id); setCopilotOpen(true); }} />
        </TabsContent>
        <TabsContent value="legacy">
          <LegacyCraTab />
        </TabsContent>
        <TabsContent value="retention">
          <Card>
            <CardHeader><CardTitle>5-Year Retention</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Filed FINTRAC reports are immutable for 5 years per PCMLTFA s.6. Underlying source transactions and identity records are similarly retained. The system enforces this with database triggers that reject UPDATE/DELETE on filed rows.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <CopilotPanel
        open={copilotOpen}
        onOpenChange={setCopilotOpen}
        context={strContextTx ? { transaction_id: strContextTx } : undefined}
      />
    </div>
  );
}

function KindTab({ kind, title, desc, onDraftStr }: { kind: FintracKind; title: string; desc: string; onDraftStr?: (id: string) => void }) {
  const { rows, isLoading, pending, filed, markFiled, markExempt } = useFintracReportsByKind(kind);
  const fmt = useCurrencyFormatter();
  const [target, setTarget] = useState<any | null>(null);
  const [mode, setMode] = useState<'file' | 'exempt'>('file');
  const [refNum, setRefNum] = useState('');
  const [notes, setNotes] = useState('');

  const totalAmt = useMemo(() => pending.reduce((s, r) => s + Number(r.aggregate_amount ?? r.amount ?? 0), 0), [pending]);

  const submit = async () => {
    if (!target) return;
    if (mode === 'file') {
      if (!refNum.trim()) return;
      await markFiled.mutateAsync({ id: target.id, fintrac_reference: refNum.trim(), notes: notes.trim() || undefined });
    } else {
      if (!notes.trim()) return;
      await markExempt.mutateAsync({ id: target.id, notes: notes.trim() });
    }
    setTarget(null); setRefNum(''); setNotes('');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-xl font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">{desc}</p>
        </div>
        <Button variant="outline" onClick={() => exportCsv(rows, kind)} disabled={!rows.length}>
          <Download className="mr-2 h-4 w-4" /> Export CSV
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Pending</CardTitle></CardHeader>
          <CardContent><p className={`text-2xl font-bold ${pending.length ? 'text-destructive' : ''}`}>{pending.length}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Pending amount</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{fmt.formatCurrency(totalAmt, { currencyOverride: 'CAD' })}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Filed</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{filed.length}</p></CardContent></Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p>
            : rows.length === 0 ? <p className="text-sm text-muted-foreground">No {kind.toUpperCase()} reports yet. Reports are auto-generated nightly by the detection job, or you can flag transactions manually.</p>
            : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Detected</TableHead>
                <TableHead>{kind === 'str' ? 'Subject' : 'Conductor'}</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Ref</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{(r.window_end ?? r.detected_at ?? r.created_at)?.slice(0, 10)}</TableCell>
                    <TableCell className="text-sm">{r.conductor_name ?? r.subject_name ?? '—'}</TableCell>
                    <TableCell><Badge variant={r.report_status === 'pending' ? 'destructive' : 'outline'} className="capitalize">{r.report_status}</Badge></TableCell>
                    <TableCell className="text-right font-medium">{fmt.formatCurrency(Number(r.aggregate_amount ?? r.amount ?? 0), { currencyOverride: r.currency || 'CAD' })}</TableCell>
                    <TableCell className="text-xs">{r.due_at?.slice(0, 10) ?? '—'}</TableCell>
                    <TableCell className="font-mono text-xs">{r.fintrac_reference ?? '—'}</TableCell>
                    <TableCell className="text-right">
                      {r.report_status === 'pending' && (
                        <div className="flex gap-2 justify-end">
                          {kind === 'str' && onDraftStr && r.related_transaction_ids?.[0] && (
                            <Button size="sm" variant="ghost" onClick={() => onDraftStr(r.related_transaction_ids[0])}>
                              <Sparkles className="h-3 w-3 mr-1" /> AI draft
                            </Button>
                          )}
                          <Button size="sm" variant="outline" onClick={() => { setTarget(r); setMode('file'); }}>
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Mark filed
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => { setTarget(r); setMode('exempt'); }}>Exempt</Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{mode === 'file' ? 'Mark report as filed' : 'Mark as exempt'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {mode === 'file' && (
              <div><Label>FINTRAC reference</Label><Input value={refNum} onChange={(e) => setRefNum(e.target.value)} placeholder="e.g. LCTR-2026-00012" /></div>
            )}
            <div>
              <Label>Notes {mode === 'exempt' && <span className="text-destructive">*</span>}</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setTarget(null)}>Cancel</Button>
            <Button onClick={submit} disabled={markFiled.isPending || markExempt.isPending}>{mode === 'file' ? 'Mark filed' : 'Mark exempt'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LegacyCraTab() {
  const { reports, isLoading, pending, markFiled, markExempt } = useFintracReports();
  const fmt = useCurrencyFormatter();
  const [target, setTarget] = useState<FintracReport | null>(null);
  const [mode, setMode] = useState<'file' | 'exempt'>('file');
  const [refNum, setRefNum] = useState('');
  const [notes, setNotes] = useState('');

  const submit = async () => {
    if (!target) return;
    if (mode === 'file') {
      if (!refNum.trim()) return;
      await markFiled.mutateAsync({ id: target.id, fintrac_reference: refNum.trim(), notes: notes.trim() || undefined });
    } else {
      if (!notes.trim()) return;
      await markExempt.mutateAsync({ id: target.id, notes: notes.trim() });
    }
    setTarget(null); setRefNum(''); setNotes('');
  };

  return (
    <Card>
      <CardHeader><CardTitle>CRA EFT Reports (legacy table)</CardTitle></CardHeader>
      <CardContent>
        {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p>
         : reports.length === 0 ? <p className="text-sm text-muted-foreground">No legacy CRA EFT reports. New EFTs are captured under the EFTR tab.</p>
         : (
          <Table>
            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Status</TableHead><TableHead>Amount</TableHead><TableHead>Ref</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>{reports.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs">{r.reportable_date}</TableCell>
                <TableCell><Badge variant={r.report_status === 'pending' ? 'destructive' : 'outline'} className="capitalize">{r.report_status}</Badge></TableCell>
                <TableCell>{fmt.formatCurrency(Number(r.aggregate_amount), { currencyOverride: r.currency || 'CAD' })}</TableCell>
                <TableCell className="font-mono text-xs">{r.fintrac_reference ?? '—'}</TableCell>
                <TableCell className="text-right">{r.report_status === 'pending' && (
                  <div className="flex gap-2 justify-end">
                    <Button size="sm" variant="outline" onClick={() => { setTarget(r); setMode('file'); }}>Mark filed</Button>
                    <Button size="sm" variant="ghost" onClick={() => { setTarget(r); setMode('exempt'); }}>Exempt</Button>
                  </div>
                )}</TableCell>
              </TableRow>
            ))}</TableBody>
          </Table>
        )}
        <p className="text-xs text-muted-foreground mt-3">Pending: {pending.length}</p>
      </CardContent>

      <Dialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{mode === 'file' ? 'Mark filed' : 'Mark exempt'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {mode === 'file' && <div><Label>FINTRAC reference</Label><Input value={refNum} onChange={(e) => setRefNum(e.target.value)} /></div>}
            <div><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setTarget(null)}>Cancel</Button>
            <Button onClick={submit}>{mode === 'file' ? 'Mark filed' : 'Mark exempt'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
