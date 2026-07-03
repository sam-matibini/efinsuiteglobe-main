import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useOrganizationContext } from '@/hooks/useOrganizationContext';
import { useIntlFilings } from '@/hooks/useIntlFilings';
import { format } from 'date-fns';

export default function UkVatFilings() {
  const { currentOrganization } = useOrganizationContext();
  const { filings, isLoading, submitMtdVat } = useIntlFilings(currentOrganization?.id);
  const uk = filings.filter((f) => f.jurisdiction === 'UK');

  const [form, setForm] = useState({
    organization_id: '', period_key: '24A1', vrn: '',
    vat_due_sales: 0, vat_due_acquisitions: 0, total_vat_due: 0,
    vat_reclaimed_curr_period: 0, net_vat_due: 0,
    total_value_sales_ex_vat: 0, total_value_purchases_ex_vat: 0,
    total_value_goods_supplied_ex_vat: 0, total_acquisitions_ex_vat: 0,
    finalised: true,
  });

  const onSubmit = () => {
    if (!currentOrganization?.id) return;
    submitMtdVat.mutate({ ...form, organization_id: currentOrganization.id });
  };

  const num = (k: keyof typeof form) => (
    <div>
      <Label className="text-xs">{String(k)}</Label>
      <Input type="number" value={form[k] as number} onChange={(e) => setForm({ ...form, [k]: Number(e.target.value) })} />
    </div>
  );

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">UK MTD VAT Filings</h1>
        <p className="text-muted-foreground">Submit Making Tax Digital VAT returns to HMRC. Simulated until HMRC secrets are configured.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>New return</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">period_key</Label>
              <Input value={form.period_key} onChange={(e) => setForm({ ...form, period_key: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">vrn</Label>
              <Input value={form.vrn} onChange={(e) => setForm({ ...form, vrn: e.target.value })} placeholder="123456789" />
            </div>
            {num('vat_due_sales')}{num('vat_due_acquisitions')}{num('total_vat_due')}
            {num('vat_reclaimed_curr_period')}{num('net_vat_due')}
            {num('total_value_sales_ex_vat')}{num('total_value_purchases_ex_vat')}
            {num('total_value_goods_supplied_ex_vat')}{num('total_acquisitions_ex_vat')}
          </div>
          <Button onClick={onSubmit} disabled={submitMtdVat.isPending}>
            {submitMtdVat.isPending ? 'Submitting…' : 'Submit return'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Submission history</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> :
            uk.length === 0 ? <p className="text-sm text-muted-foreground">No UK filings yet.</p> :
            <ul className="divide-y">
              {uk.map((f) => (
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
