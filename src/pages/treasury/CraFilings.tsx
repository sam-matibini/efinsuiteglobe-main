import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { FileCode2, Download, CheckCircle2, Plus } from 'lucide-react';
import { useCraFilings, type CraFilingType } from '@/hooks/useCraFilings';

const FILING_LABELS: Record<CraFilingType, string> = {
  t4_summary: 'T4 Summary',
  t4_slips: 'T4 Slip batch',
  t5018: 'T5018 contractor slips',
  t5_summary: 'T5 investment income slips',
  pd7a: 'PD7A payroll remittance summary',
  gst_hst_netfile: 'GST/HST NETFILE',
};

export default function CraFilings() {
  const { filings, generate, markSubmitted, downloadXml } = useCraFilings();
  const [genOpen, setGenOpen] = useState(false);
  const [form, setForm] = useState<{ filing_type: CraFilingType; period_start: string; period_end: string }>({
    filing_type: 't4_summary',
    period_start: new Date().getFullYear() + '-01-01',
    period_end: new Date().getFullYear() + '-12-31',
  });
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [confirmNumber, setConfirmNumber] = useState('');

  const submit = async () => {
    await generate.mutateAsync(form);
    setGenOpen(false);
  };

  const confirmSubmission = async () => {
    if (!confirmId || !confirmNumber) return;
    await markSubmitted.mutateAsync({ id: confirmId, confirmation_number: confirmNumber });
    setConfirmId(null);
    setConfirmNumber('');
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">CRA XML Filings</h1>
          <p className="text-muted-foreground">Generate T4, T5, T5018, PD7A and GST/HST NETFILE XML for upload to CRA Internet File Transfer.</p>
        </div>
        <Button onClick={() => setGenOpen(true)}><Plus className="mr-1 h-4 w-4" /> Generate filing</Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><FileCode2 className="h-5 w-5" /> Filings</CardTitle></CardHeader>
        <CardContent>
          {filings.length === 0 ? (
            <p className="text-sm text-muted-foreground">No filings yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {filings.map((f) => (
                <li key={f.id} className="flex justify-between items-center border-b py-2">
                  <span>
                    <span className="font-medium mr-2">{FILING_LABELS[f.filing_type] ?? f.filing_type}</span>
                    <span className="text-muted-foreground font-mono text-xs">{f.period_start} → {f.period_end}</span>
                    {f.schema_version && <span className="ml-2 text-xs text-muted-foreground border rounded px-1.5 py-0.5">Schema {f.schema_version}</span>}
                    {f.confirmation_number && <span className="ml-2 text-xs">CRA #{f.confirmation_number}</span>}
                  </span>
                  <span className="flex items-center gap-2">
                    <Badge variant={f.status === 'accepted' ? 'default' : f.status === 'rejected' ? 'destructive' : 'outline'}>{f.status}</Badge>
                    {f.xml_storage_path && (
                      <Button size="sm" variant="outline" onClick={() => downloadXml(f)}>
                        <Download className="h-3 w-3 mr-1" /> XML
                      </Button>
                    )}
                    {['generated', 'draft'].includes(f.status) && (
                      <Button size="sm" variant="ghost" onClick={() => setConfirmId(f.id)}>
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Mark submitted
                      </Button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={genOpen} onOpenChange={setGenOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Generate XML filing</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Filing type</Label>
              <Select value={form.filing_type} onValueChange={(v) => setForm((f) => ({ ...f, filing_type: v as CraFilingType }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(FILING_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Period start</Label>
                <Input type="date" value={form.period_start} onChange={(e) => setForm((f) => ({ ...f, period_start: e.target.value }))} />
              </div>
              <div>
                <Label>Period end</Label>
                <Input type="date" value={form.period_end} onChange={(e) => setForm((f) => ({ ...f, period_end: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setGenOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={generate.isPending}>Generate</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmId} onOpenChange={(o) => !o && setConfirmId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Record CRA confirmation</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Label>Confirmation number</Label>
            <Input value={confirmNumber} onChange={(e) => setConfirmNumber(e.target.value)} placeholder="e.g. 1234567890" />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmId(null)}>Cancel</Button>
            <Button onClick={confirmSubmission} disabled={!confirmNumber || markSubmitted.isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
