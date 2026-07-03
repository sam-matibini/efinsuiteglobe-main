import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MapPin, RefreshCw, FileText, Plus, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useUsRemittance } from '@/hooks/useUsRemittance';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';

const US_STATES = ['CA','NY','TX','FL','WA','IL','PA','OH','GA','NC'];

function nexusBadge(status: string) {
  if (status === 'active') return <Badge variant="secondary" className="gap-1"><CheckCircle2 className="h-3 w-3"/>Registered</Badge>;
  if (status === 'triggered') return <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3"/>Nexus triggered</Badge>;
  return <Badge variant="outline">Monitoring</Badge>;
}

export default function UsRemittanceCentre() {
  const { jurisdictions, filings, runNexusCheck, generate941, upsertJurisdiction } = useUsRemittance();
  const fmt = useCurrencyFormatter();
  const [addOpen, setAddOpen] = useState(false);
  const [state, setState] = useState('CA');
  const [year, setYear] = useState(new Date().getFullYear());
  const [quarter, setQuarter] = useState(1);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">US Remittance Centre</h1>
          <p className="text-muted-foreground">IRS 941, sales-tax nexus, and state payroll filings.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => runNexusCheck.mutate()} disabled={runNexusCheck.isPending}>
            <RefreshCw className={`mr-2 h-4 w-4 ${runNexusCheck.isPending ? 'animate-spin' : ''}`}/>Scan nexus
          </Button>
          <Button onClick={() => setAddOpen(true)}><Plus className="mr-2 h-4 w-4"/>Add state</Button>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5"/>Generate IRS 941</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <div><Label>Tax year</Label><Input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-32"/></div>
            <div>
              <Label>Quarter</Label>
              <Select value={String(quarter)} onValueChange={(v) => setQuarter(Number(v))}>
                <SelectTrigger className="w-32"><SelectValue/></SelectTrigger>
                <SelectContent>{[1,2,3,4].map((q) => <SelectItem key={q} value={String(q)}>Q{q}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button onClick={() => generate941.mutate({ tax_year: year, quarter })} disabled={generate941.isPending}>
              Generate 941 XML
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5"/>Sales tax nexus</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>State</TableHead>
                <TableHead>YTD revenue</TableHead>
                <TableHead>YTD txns</TableHead>
                <TableHead>Threshold</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last check</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jurisdictions.map((j) => (
                <TableRow key={j.id}>
                  <TableCell className="font-medium">{j.state_code}</TableCell>
                  <TableCell>{fmt.formatWithSymbol(j.ytd_revenue)}</TableCell>
                  <TableCell>{j.ytd_transactions}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{fmt.formatWithSymbol(j.economic_nexus_revenue)} / {j.economic_nexus_transactions}</TableCell>
                  <TableCell>{nexusBadge(j.nexus_status)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{j.last_checked_at ? new Date(j.last_checked_at).toLocaleDateString() : '—'}</TableCell>
                </TableRow>
              ))}
              {jurisdictions.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No states tracked. Click <strong>Add state</strong> to start.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Recent IRS filings</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow><TableHead>Type</TableHead><TableHead>Year</TableHead><TableHead>Period</TableHead><TableHead>Status</TableHead><TableHead>XML</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {filings.map((f) => (
                <TableRow key={f.id}>
                  <TableCell>{f.filing_type}</TableCell>
                  <TableCell>{f.tax_year}</TableCell>
                  <TableCell>{f.period ?? '—'}</TableCell>
                  <TableCell><Badge variant="outline">{f.status}</Badge></TableCell>
                  <TableCell>{f.xml_url ? <a className="text-primary underline" href={f.xml_url} target="_blank" rel="noopener noreferrer">Download</a> : '—'}</TableCell>
                </TableRow>
              ))}
              {filings.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">No filings yet</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Track a state</DialogTitle></DialogHeader>
          <div>
            <Label>State</Label>
            <Select value={state} onValueChange={setState}>
              <SelectTrigger><SelectValue/></SelectTrigger>
              <SelectContent>{US_STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={async () => { await upsertJurisdiction.mutateAsync({ state_code: state, country: 'US' }); setAddOpen(false); }}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
