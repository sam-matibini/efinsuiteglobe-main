import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useOrganizationContext } from '@/hooks/useOrganizationContext';
import { useIntlFilings } from '@/hooks/useIntlFilings';
import { format } from 'date-fns';
import { Trash2, Plus } from 'lucide-react';

interface Line { country: string; rate: number; net: number; vat: number }

export default function EuOssFilings() {
  const { currentOrganization } = useOrganizationContext();
  const { filings, isLoading, submitOssVat } = useIntlFilings(currentOrganization?.id);
  const eu = filings.filter((f) => f.jurisdiction === 'EU');

  const [periodKey, setPeriodKey] = useState('2024Q1');
  const [vatId, setVatId] = useState('');
  const [lines, setLines] = useState<Line[]>([{ country: 'DE', rate: 19, net: 0, vat: 0 }]);

  const total = lines.reduce((s, l) => s + l.vat, 0);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">EU OSS VAT Returns</h1>
        <p className="text-muted-foreground">One Stop Shop VAT for distance sales across EU member states.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>New OSS return</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">period_key</Label><Input value={periodKey} onChange={(e) => setPeriodKey(e.target.value)} /></div>
            <div><Label className="text-xs">VAT ID</Label><Input value={vatId} onChange={(e) => setVatId(e.target.value)} placeholder="DE123456789" /></div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Member state supplies</Label>
              <Button size="sm" variant="outline" onClick={() => setLines([...lines, { country: 'FR', rate: 20, net: 0, vat: 0 }])}>
                <Plus className="h-3 w-3 mr-1" />Add line
              </Button>
            </div>
            {lines.map((l, i) => (
              <div key={i} className="grid grid-cols-5 gap-2 items-end">
                <div><Label className="text-xs">Country</Label><Input value={l.country} onChange={(e) => { const n = [...lines]; n[i].country = e.target.value.toUpperCase(); setLines(n); }} /></div>
                <div><Label className="text-xs">Rate %</Label><Input type="number" value={l.rate} onChange={(e) => { const n = [...lines]; n[i].rate = Number(e.target.value); setLines(n); }} /></div>
                <div><Label className="text-xs">Net</Label><Input type="number" value={l.net} onChange={(e) => { const n = [...lines]; n[i].net = Number(e.target.value); setLines(n); }} /></div>
                <div><Label className="text-xs">VAT</Label><Input type="number" value={l.vat} onChange={(e) => { const n = [...lines]; n[i].vat = Number(e.target.value); setLines(n); }} /></div>
                <Button size="icon" variant="ghost" onClick={() => setLines(lines.filter((_, j) => j !== i))}><Trash2 className="h-3 w-3" /></Button>
              </div>
            ))}
            <div className="text-sm text-muted-foreground">Total VAT: {total.toFixed(2)}</div>
          </div>
          <Button disabled={submitOssVat.isPending} onClick={() => currentOrganization?.id && submitOssVat.mutate({
            organization_id: currentOrganization.id, period_key: periodKey, vat_id: vatId, lines,
          })}>
            {submitOssVat.isPending ? 'Submitting…' : 'Submit OSS return'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Submission history</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> :
            eu.length === 0 ? <p className="text-sm text-muted-foreground">No EU filings yet.</p> :
            <ul className="divide-y">
              {eu.map((f) => (
                <li key={f.id} className="py-2 flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">Period {f.period_key}</div>
                    <div className="text-xs text-muted-foreground">{format(new Date(f.created_at), 'PPp')} · ref {f.provider_reference ?? '—'}</div>
                  </div>
                  <Badge variant={f.status === 'submitted' || f.status === 'accepted' ? 'default' : f.status === 'failed' ? 'destructive' : 'secondary'}>{f.status}</Badge>
                </li>
              ))}
            </ul>}
        </CardContent>
      </Card>
    </div>
  );
}
