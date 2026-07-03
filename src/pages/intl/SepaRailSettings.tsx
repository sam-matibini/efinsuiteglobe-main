import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useOrganizationContext } from '@/hooks/useOrganizationContext';
import { useSepaRails } from '@/hooks/useSepaRails';
import { format } from 'date-fns';
import { Plus, Trash2 } from 'lucide-react';

interface Entry { name: string; iban: string; bic?: string; amount: number; remittance?: string }

export default function SepaRailSettings() {
  const { currentOrganization } = useOrganizationContext();
  const { submissions, isLoading, submit } = useSepaRails(currentOrganization?.id);

  const [debtor, setDebtor] = useState({ name: '', iban: '', bic: '' });
  const [entries, setEntries] = useState<Entry[]>([{ name: '', iban: '', bic: '', amount: 0, remittance: '' }]);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">SEPA Credit Transfer</h1>
        <p className="text-muted-foreground">Generate pain.001 SEPA payment files and upload to your bank SFTP. Simulated until SEPA_SFTP_* secrets are configured.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Debtor</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-3 gap-3">
          <div><Label className="text-xs">Name</Label><Input value={debtor.name} onChange={(e) => setDebtor({ ...debtor, name: e.target.value })} /></div>
          <div><Label className="text-xs">IBAN</Label><Input value={debtor.iban} onChange={(e) => setDebtor({ ...debtor, iban: e.target.value })} /></div>
          <div><Label className="text-xs">BIC</Label><Input value={debtor.bic} onChange={(e) => setDebtor({ ...debtor, bic: e.target.value })} /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Beneficiaries</CardTitle>
            <Button size="sm" variant="outline" onClick={() => setEntries([...entries, { name: '', iban: '', bic: '', amount: 0, remittance: '' }])}>
              <Plus className="h-3 w-3 mr-1" />Add
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {entries.map((e, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-end">
              <div className="col-span-3"><Label className="text-xs">Name</Label><Input value={e.name} onChange={(ev) => { const n = [...entries]; n[i].name = ev.target.value; setEntries(n); }} /></div>
              <div className="col-span-3"><Label className="text-xs">IBAN</Label><Input value={e.iban} onChange={(ev) => { const n = [...entries]; n[i].iban = ev.target.value; setEntries(n); }} /></div>
              <div className="col-span-2"><Label className="text-xs">BIC</Label><Input value={e.bic} onChange={(ev) => { const n = [...entries]; n[i].bic = ev.target.value; setEntries(n); }} /></div>
              <div className="col-span-2"><Label className="text-xs">Amount</Label><Input type="number" value={e.amount} onChange={(ev) => { const n = [...entries]; n[i].amount = Number(ev.target.value); setEntries(n); }} /></div>
              <div className="col-span-1"><Label className="text-xs">Memo</Label><Input value={e.remittance} onChange={(ev) => { const n = [...entries]; n[i].remittance = ev.target.value; setEntries(n); }} /></div>
              <Button size="icon" variant="ghost" onClick={() => setEntries(entries.filter((_, j) => j !== i))}><Trash2 className="h-3 w-3" /></Button>
            </div>
          ))}
          <Button className="mt-4" disabled={submit.isPending} onClick={() => currentOrganization?.id && submit.mutate({
            organization_id: currentOrganization.id, debtor_name: debtor.name, debtor_iban: debtor.iban, debtor_bic: debtor.bic, entries,
          })}>
            {submit.isPending ? 'Generating…' : 'Generate & upload SEPA file'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Submission history</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> :
            submissions.length === 0 ? <p className="text-sm text-muted-foreground">No SEPA submissions yet.</p> :
            <ul className="divide-y">
              {submissions.map((s) => (
                <li key={s.id} className="py-2 flex items-center justify-between">
                  <div>
                    <div className="font-medium">{s.batch_reference}</div>
                    <div className="text-xs text-muted-foreground">{format(new Date(s.created_at), 'PPp')} · {s.entry_count} entries · €{Number(s.total_amount).toFixed(2)}</div>
                  </div>
                  <Badge variant={s.status === 'submitted' ? 'default' : s.status === 'failed' ? 'destructive' : 'secondary'}>{s.status}</Badge>
                </li>
              ))}
            </ul>}
        </CardContent>
      </Card>
    </div>
  );
}
