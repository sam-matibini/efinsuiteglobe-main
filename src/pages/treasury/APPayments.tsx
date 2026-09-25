import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAPPaymentBatches, BatchProvider } from '@/hooks/useAPPaymentBatches';
import { useBills } from '@/hooks/useBills';
import { useBankAccounts } from '@/hooks/useBankAccounts';
import { FundingBankSelect } from '@/components/treasury/FundingBankSelect';
import { useIsReadOnly } from '@/hooks/useIsReadOnly';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';

export default function APPayments() {
  const { batches, isLoading, create, updateStatus } = useAPPaymentBatches();
  const { bills } = useBills();
  const { accounts: bankAccounts } = useBankAccounts();
  const isReadOnly = useIsReadOnly();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [provider, setProvider] = useState<BatchProvider>('manual');
  const [bankId, setBankId] = useState('');
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));

  const dueBills = (bills ?? []).filter((b) => Number(b.balance_due) > 0 && b.status !== 'paid');

  const toggle = (id: string) => {
    const s = new Set(selected);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelected(s);
  };

  const submit = async () => {
    const items = dueBills
      .filter((b) => selected.has(b.id))
      .map((b) => ({ bill_id: b.id, vendor_id: b.vendor_id, amount: Number(b.balance_due), currency: b.currency }));
    if (items.length === 0) return;
    await create.mutateAsync({
      pay_date: payDate,
      funding_bank_account_id: bankId || null,
      provider,
      currency: items[0].currency || 'CAD',
      items,
    });
    setOpen(false);
    setSelected(new Set());
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">AP Payments</h1>
          <p className="text-muted-foreground">Pay supplier bills via Stripe, Plaid or manual rails</p>
        </div>
        {!isReadOnly && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />New Payment Batch</Button></DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>Create AP Payment Batch</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div><Label>Pay date</Label><Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} /></div>
                  <div><Label>Provider</Label>
                    <Select value={provider} onValueChange={(v) => setProvider(v as BatchProvider)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manual">Manual</SelectItem>
                        <SelectItem value="stripe">Stripe</SelectItem>
                        <SelectItem value="plaid">Plaid ACH</SelectItem>
                        <SelectItem value="paysafe_eft">Paysafe EFT</SelectItem>
                        <SelectItem value="paysafe_card">Paysafe Card (Credit / Debit Visa)</SelectItem>
                        <SelectItem value="wise_eft">Wise EFT</SelectItem>
                        <SelectItem value="wise_etransfer">Wise e-Transfer</SelectItem>
                        <SelectItem value="wise_card">Wise Card payout</SelectItem>
                        <SelectItem value="wire">Wire</SelectItem>
                        <SelectItem value="cheque">Cheque</SelectItem>
                      </SelectContent>
                    </Select>
                    {provider === 'paysafe_eft' && (
                      <p className="text-xs text-muted-foreground mt-1">Canadian EFT debit via Paysafe, 3–5 business days.</p>
                    )}
                    {provider === 'paysafe_card' && (
                      <p className="text-xs text-muted-foreground mt-1">Hosted card payout link emailed to each vendor, settles 1–2 days.</p>
                    )}
                  </div>
                </div>
                <div>
                  <Label>Funding bank</Label>
                  <FundingBankSelect
                    value={bankId}
                    onValueChange={setBankId}
                    requireRail={provider === 'stripe' || provider === 'plaid' ? 'ach' : 'any'}
                  />
                </div>
                <div className="max-h-80 overflow-y-auto border rounded">
                  <Table>
                    <TableHeader><TableRow><TableHead></TableHead><TableHead>Bill</TableHead><TableHead>Vendor</TableHead><TableHead className="text-right">Balance</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {dueBills.map((b) => (
                        <TableRow key={b.id}>
                          <TableCell><Checkbox checked={selected.has(b.id)} onCheckedChange={() => toggle(b.id)} /></TableCell>
                          <TableCell className="font-mono text-xs">{b.bill_number}</TableCell>
                          <TableCell className="text-xs">{b.vendor_id?.slice(0, 8)}</TableCell>
                          <TableCell className="text-right">{Number(b.balance_due).toFixed(2)} {b.currency}</TableCell>
                        </TableRow>
                      ))}
                      {dueBills.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground">No outstanding bills</TableCell></TableRow>}
                    </TableBody>
                  </Table>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={submit} disabled={selected.size === 0 || create.isPending}>Create Batch ({selected.size})</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card>
        <CardHeader><CardTitle>Payment Batches</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <p>Loading…</p> : batches.length === 0 ? (
            <p className="text-sm text-muted-foreground">No batches yet.</p>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Batch #</TableHead><TableHead>Pay date</TableHead><TableHead>Provider</TableHead>
                <TableHead className="text-right">Total</TableHead><TableHead>Status</TableHead><TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {batches.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell><Link to={`/treasury/ap-payments/${b.id}`} className="font-mono text-xs hover:underline">{b.batch_number}</Link></TableCell>
                    <TableCell>{b.pay_date}</TableCell>
                    <TableCell className="capitalize">{b.provider}</TableCell>
                    <TableCell className="text-right font-medium">{Number(b.total_amount).toFixed(2)} {b.currency}</TableCell>
                    <TableCell><Badge variant={b.status === 'completed' ? 'default' : b.status === 'failed' ? 'destructive' : 'secondary'}>{b.status}</Badge></TableCell>
                    <TableCell>
                      {!isReadOnly && b.status === 'draft' && <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: b.id, status: 'approved' })}>Approve</Button>}
                      {!isReadOnly && b.status === 'approved' && <Button size="sm" onClick={() => updateStatus.mutate({ id: b.id, status: 'completed' })}>Mark Paid</Button>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
