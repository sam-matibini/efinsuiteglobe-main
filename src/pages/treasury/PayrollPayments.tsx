import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Play } from 'lucide-react';
import { usePayrollPaymentBatches, PayrollBatchProvider, providerDefaultRail } from '@/hooks/usePayrollPaymentBatches';
import { usePayRuns } from '@/hooks/usePayRuns';
import { FundingBankSelect } from '@/components/treasury/FundingBankSelect';
import { RailPicker, PROVIDER_RAILS } from '@/components/treasury/RailPicker';
import { useFundingBankAccounts, Rail } from '@/hooks/useFundingBankAccounts';
import { useIsReadOnly } from '@/hooks/useIsReadOnly';

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  draft: 'outline', approved: 'secondary', processing: 'secondary',
  completed: 'default', partial: 'destructive', failed: 'destructive', cancelled: 'outline',
};

export default function PayrollPayments() {
  const { batches, isLoading, create, process } = usePayrollPaymentBatches();
  const { payRuns } = usePayRuns();
  const { accounts: fundingAccounts } = useFundingBankAccounts();
  const isReadOnly = useIsReadOnly();
  const { isEnabled } = usePayoutProviderToggles();



  const [open, setOpen] = useState(false);
  const [payRunId, setPayRunId] = useState<string>('');
  const [bankId, setBankId] = useState<string>('');
  const [provider, setProvider] = useState<PayrollBatchProvider>('stripe');
  const [rail, setRail] = useState<Rail>('ach');
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));

  const eligibleRuns = (payRuns ?? []).filter((r) => ['approved', 'processed'].includes(r.status as string));
  const selectedBank = fundingAccounts.find((a) => a.id === bankId);
  const availableRails = [
    ...(selectedBank?.railsSupported ?? (['manual', 'cheque'] as Rail[])),
    ...PROVIDER_RAILS,
  ];

  const changeProvider = (v: PayrollBatchProvider) => {
    setProvider(v);
    setRail(providerDefaultRail(v) as Rail);
  };

  const submit = async () => {
    if (!payRunId) return;
    await create.mutateAsync({
      pay_run_id: payRunId,
      pay_date: payDate,
      funding_bank_account_id: bankId || null,
      provider,
      default_rail: rail,
    });
    setOpen(false);
    setPayRunId('');
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Payroll Payments</h1>
          <p className="text-muted-foreground">Draw employee net pay from your funding bank via ACH, EFT, wire, wallet or cheque</p>
        </div>
        {!isReadOnly && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />New Payroll Batch</Button></DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>Create Payroll Payment Batch</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Pay run</Label>
                  <Select value={payRunId} onValueChange={setPayRunId}>
                    <SelectTrigger><SelectValue placeholder="Choose an approved pay run" /></SelectTrigger>
                    <SelectContent>
                      {eligibleRuns.length === 0 && (
                        <div className="px-3 py-2 text-xs text-muted-foreground">No approved pay runs ready to pay.</div>
                      )}
                      {eligibleRuns.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.pay_period_start} → {r.pay_period_end} · ${Number(r.total_net ?? 0).toFixed(2)} ({r.employee_count ?? 0} emp.)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Pay date</Label>
                    <Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
                  </div>
                  <div>
                    <Label>Provider</Label>
                    <Select value={provider} onValueChange={(v) => changeProvider(v as PayrollBatchProvider)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectLabel>Banks & processors</SelectLabel>
                          {isEnabled('stripe') && <SelectItem value="stripe">Stripe</SelectItem>}
                          {isEnabled('plaid') && <SelectItem value="plaid">Plaid</SelectItem>}
                          {isEnabled('paysafe') && <SelectItem value="paysafe_eft">Paysafe EFT</SelectItem>}
                          {isEnabled('paysafe') && <SelectItem value="paysafe_card">Paysafe Card (Credit / Debit Visa)</SelectItem>}
                          {isEnabled('wire') && <SelectItem value="wire">Wire</SelectItem>}
                        </SelectGroup>
                        {isEnabled('wise') && (
                          <SelectGroup>
                            <SelectLabel>Wise</SelectLabel>
                            <SelectItem value="wise_eft">Wise EFT</SelectItem>
                            <SelectItem value="wise_etransfer">Wise e-Transfer</SelectItem>
                            <SelectItem value="wise_card">Wise Card payout</SelectItem>
                          </SelectGroup>
                        )}
                        <SelectGroup>
                          <SelectLabel>Wallets</SelectLabel>
                          {isEnabled('stripe') && <SelectItem value="wallet">Stripe / Paddle Wallet</SelectItem>}
                          {isEnabled('efinmoney') && <SelectItem value="efinmoney">eFinMoney Wallet</SelectItem>}
                        </SelectGroup>
                        <SelectGroup>
                          <SelectLabel>Other</SelectLabel>
                          {isEnabled('cheque') && <SelectItem value="cheque">Cheque</SelectItem>}
                          {isEnabled('manual') && <SelectItem value="manual">Manual</SelectItem>}
                        </SelectGroup>
                      </SelectContent>

                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Funding bank account</Label>
                  <FundingBankSelect value={bankId} onValueChange={setBankId} requireRail="any" />
                </div>
                <div>
                  <Label>Default rail (per employee, can be edited later)</Label>
                  <RailPicker value={rail} onChange={setRail} available={availableRails} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={submit} disabled={!payRunId || create.isPending}>Create batch</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card>
        <CardHeader><CardTitle>Batches</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <p>Loading…</p> : batches.length === 0 ? (
            <p className="text-sm text-muted-foreground">No payroll payment batches yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Batch</TableHead>
                  <TableHead>Pay date</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Approval</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell>
                      <Link className="font-mono text-xs hover:underline" to={`/treasury/payroll-payments/${b.id}`}>
                        {b.batch_number}
                      </Link>
                    </TableCell>
                    <TableCell>{b.pay_date}</TableCell>
                    <TableCell><Badge variant="outline">{b.provider}</Badge></TableCell>
                    <TableCell><Badge variant="secondary">{b.approval_state.replace('_', ' ')}</Badge></TableCell>
                    <TableCell><Badge variant={STATUS_VARIANT[b.status] ?? 'outline'}>{b.status}</Badge></TableCell>
                    <TableCell className="text-right font-mono">{b.currency} {Number(b.total_net).toFixed(2)}</TableCell>
                    <TableCell>
                      {!isReadOnly && b.approval_state === 'approved' && ['draft', 'approved'].includes(b.status) && (
                        <Button size="sm" variant="outline" onClick={() => process.mutate(b.id)}>
                          <Play className="mr-2 h-3 w-3" /> Process
                        </Button>
                      )}
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
