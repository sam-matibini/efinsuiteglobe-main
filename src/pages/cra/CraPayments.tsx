import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Clock, Download, ExternalLink, FileText, Landmark, Plus, Settings2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CraModule } from '@/components/cra/CraModule';
import { PaymentWizard } from '@/components/cra/mypayment/PaymentWizard';
import { PaymentDetailSheet, StatusBadge } from '@/components/cra/mypayment/PaymentDetailSheet';
import { useCraMyPayments, type MyPaymentRow } from '@/hooks/useCraMyPayments';
import { useCraTaxCentre } from '@/hooks/useCraTaxCentre';
import { MY_PAYMENT_INFO_URL } from '@/lib/cra/mypayment/catalog';
import { STATUS_LABEL, WORKFLOW_STATUSES, dashboardTotals, formatCad, type WorkflowStatus } from '@/lib/cra/mypayment/workflow';

function csvCell(value: unknown) {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export default function CraPayments() {
  const cra = useCraTaxCentre();
  const pay = useCraMyPayments();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editing, setEditing] = useState<MyPaymentRow | null>(null);
  const [selected, setSelected] = useState<MyPaymentRow | null>(null);
  const [status, setStatus] = useState<'all' | 'pending' | 'completed' | WorkflowStatus>('all');
  const [taxType, setTaxType] = useState('all');
  const [client, setClient] = useState('all');
  const [period, setPeriod] = useState('');

  const totals = useMemo(() => dashboardTotals(pay.payments), [pay.payments]);
  const clients = useMemo(() => [...new Set(pay.payments.map((p) => p.business_name).filter(Boolean) as string[])].sort(), [pay.payments]);
  const taxTypes = useMemo(() => {
    const seen = new Map<string, string>();
    for (const p of pay.payments) seen.set(`${p.payer_kind}:${p.cra_payment_type}`, pay.typeLabel(p));
    return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [pay]);

  const filtered = useMemo(() => pay.payments.filter((p) => {
    if (status === 'pending' && !['awaiting_authorization', 'awaiting_payment', 'payment_initiated'].includes(p.workflow_status)) return false;
    if (status === 'completed' && !['payment_completed', 'reconciliation_pending', 'reconciled'].includes(p.workflow_status)) return false;
    if (status !== 'all' && status !== 'pending' && status !== 'completed' && p.workflow_status !== status) return false;
    if (taxType !== 'all' && `${p.payer_kind}:${p.cra_payment_type}` !== taxType) return false;
    if (client !== 'all' && p.business_name !== client) return false;
    if (period.trim()) {
      const q = period.trim().toLowerCase();
      const hay = `${p.filing_period_label ?? ''} ${p.period_start ?? ''} ${p.period_end ?? ''} ${p.paid_at ?? ''} ${p.scheduled_for ?? ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }), [pay.payments, status, taxType, client, period]);

  const receipts = pay.payments.filter((p) => p.receipt_path);
  const balances = cra.ledger.balances;
  const outstanding: { label: string; value: number | null }[] = [
    { label: 'GST/HST', value: balances.gst_hst },
    { label: 'Payroll source deductions', value: balances.payroll },
    { label: 'Corporation income tax', value: balances.corporate_tax },
  ];
  const knownOutstanding = outstanding.reduce((sum, row) => sum + (row.value ?? 0), 0);
  const anyKnown = outstanding.some((row) => row.value !== null) || balances.total_owing !== null;

  const exportCsv = () => {
    const header = ['Reference', 'Status', 'Client', 'Business number', 'Program account', 'Tax type', 'Allocation', 'Tax period', 'Amount', 'Intended date', 'Paid on', 'CRA confirmation', 'Journal posted', 'Reconciled'];
    const lines = filtered.map((p) => [
      p.reference, STATUS_LABEL[p.workflow_status], p.business_name, p.business_number, p.program_account, pay.typeLabel(p), pay.allocationLabel(p),
      p.filing_period_label, p.amount.toFixed(2), p.scheduled_for, p.paid_at?.slice(0, 10), p.confirmation_number, p.journal_entry_id ? 'Yes' : 'No', p.workflow_status === 'reconciled' ? 'Yes' : 'No',
    ].map(csvCell).join(','));
    const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cra-payments-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const openReceipt = async (row: MyPaymentRow) => {
    try {
      window.open(await pay.receiptUrl(row.receipt_path!), '_blank', 'noopener,noreferrer');
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const startNew = () => {
    setEditing(null);
    setWizardOpen(true);
  };

  return (
    <CraModule
      title="CRA Payments"
      description="Prepare, approve and track payments to the CRA. You complete each payment on CRA My Payment; eFinsuite records the confirmation, posts the journal entry and matches the bank transaction."
      actions={
        <>
          <Button variant="outline" asChild><Link to="/settings?tab=integrations"><Settings2 className="mr-1 h-4 w-4" />Approval & representative settings</Link></Button>
          <Button onClick={startNew} disabled={!cra.can('prepare_payment')}><Plus className="mr-1 h-4 w-4" />New CRA payment</Button>
        </>
      }
    >
      {pay.loadError ? (
        <Card className="border-destructive/50">
          <CardContent className="flex items-start gap-2 p-4 text-sm"><AlertTriangle className="mt-0.5 h-4 w-4 text-destructive" />{pay.loadError}</CardContent>
        </Card>
      ) : null}

      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <Landmark className="mt-0.5 h-6 w-6 text-primary" />
            <div>
              <div className="font-semibold">Pay through CRA My Payment</div>
              <p className="text-sm text-muted-foreground">
                Debit card (Visa Debit, Debit Mastercard), Apple Pay, Google Pay or Konek. Credit cards are not accepted by CRA.{' '}
                <a href={MY_PAYMENT_INFO_URL} target="_blank" rel="noopener noreferrer" className="underline">About My Payment</a>
              </p>
            </div>
          </div>
          <Button size="lg" onClick={startNew} disabled={!cra.can('prepare_payment')}>
            Pay now using CRA My Payment <ExternalLink className="ml-2 h-4 w-4" />
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />} label="Total CRA payments" value={formatCad(totals.totalPaid)} sub={`${totals.completedCount} completed · ${totals.unreconciledCount} not yet reconciled`} onClick={() => setStatus('completed')} />
        <Kpi icon={<Clock className="h-4 w-4 text-amber-600" />} label="Pending payments" value={String(totals.pendingCount)} sub={`${formatCad(totals.pendingAmount)} initiated, not confirmed`} onClick={() => setStatus('pending')} />
        <Kpi icon={<XCircle className="h-4 w-4 text-red-600" />} label="Failed payments" value={String(totals.failedCount)} sub={`${totals.draftCount} drafts`} onClick={() => setStatus('payment_failed')} />
        <Kpi
          icon={<AlertTriangle className="h-4 w-4 text-orange-600" />}
          label="Outstanding taxes"
          value={anyKnown ? formatCad(balances.total_owing ?? knownOutstanding) : 'Not available'}
          sub={anyKnown ? 'From the balances CRA returned' : 'CRA has not returned balances'}
        />
      </div>

      {anyKnown ? (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Outstanding by tax</CardTitle><CardDescription>Balances last returned by CRA in Tax & CRA. Pay any line from here.</CardDescription></CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-3">
            {outstanding.map((row) => (
              <div key={row.label} className="rounded-md border p-3 text-sm">
                <div className="text-muted-foreground">{row.label}</div>
                <div className="text-lg font-semibold tabular-nums">{row.value === null ? '—' : formatCad(row.value)}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Tabs defaultValue="history">
        <TabsList>
          <TabsTrigger value="history">Payment history</TabsTrigger>
          <TabsTrigger value="receipts">Payment receipts ({receipts.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="history" className="space-y-3">
          <div className="grid gap-2 md:grid-cols-5">
            <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="pending">Pending (initiated, not confirmed)</SelectItem>
                <SelectItem value="completed">Completed (confirmed)</SelectItem>
                {WORKFLOW_STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={taxType} onValueChange={setTaxType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All tax types</SelectItem>
                {taxTypes.map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={client} onValueChange={setClient}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All clients</SelectItem>
                {clients.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="Tax period, e.g. October 2026 or 2026-10" />
            <Button variant="outline" onClick={exportCsv} disabled={!filtered.length}><Download className="mr-1 h-4 w-4" />Export CSV</Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reference</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Tax type</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pay.isLoading ? (
                    <TableRow><TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">Loading CRA payments…</TableCell></TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                      {pay.payments.length ? 'No payments match these filters.' : 'No CRA payments yet. Start with New CRA payment.'}
                    </TableCell></TableRow>
                  ) : filtered.map((p) => (
                    <TableRow key={p.id} className="cursor-pointer" onClick={() => setSelected(p)}>
                      <TableCell className="font-medium">{p.reference}</TableCell>
                      <TableCell>{p.business_name}</TableCell>
                      <TableCell>
                        <div>{pay.typeLabel(p)}</div>
                        <div className="text-xs text-muted-foreground">{pay.allocationLabel(p)}</div>
                      </TableCell>
                      <TableCell>{p.filing_period_label ?? '—'}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCad(p.amount)}</TableCell>
                      <TableCell className="whitespace-nowrap">{p.paid_at?.slice(0, 10) ?? p.scheduled_for ?? '—'}</TableCell>
                      <TableCell><StatusBadge status={p.workflow_status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="receipts">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reference</TableHead>
                    <TableHead>Tax type</TableHead>
                    <TableHead>CRA confirmation</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Paid on</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {receipts.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">No receipts attached yet.</TableCell></TableRow>
                  ) : receipts.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.reference}</TableCell>
                      <TableCell>{pay.typeLabel(p)}</TableCell>
                      <TableCell>{p.confirmation_number ?? '—'}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCad(p.amount)}</TableCell>
                      <TableCell>{p.paid_at?.slice(0, 10) ?? '—'}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => openReceipt(p)}><FileText className="mr-1 h-4 w-4" />Download</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <PaymentWizard open={wizardOpen} onOpenChange={setWizardOpen} editing={editing} onSaved={(row) => setSelected(row)} />
      <PaymentDetailSheet
        row={selected}
        onOpenChange={(open) => !open && setSelected(null)}
        onEdit={(row) => { setSelected(null); setEditing(row); setWizardOpen(true); }}
      />
    </CraModule>
  );
}

function Kpi({ icon, label, value, sub, onClick }: { icon: React.ReactNode; label: string; value: string; sub: string; onClick?: () => void }) {
  return (
    <Card className={onClick ? 'cursor-pointer transition-colors hover:bg-muted/40' : undefined} onClick={onClick}>
      <CardContent className="space-y-1 p-4">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{icon}{label}</div>
        <div className="text-2xl font-semibold tabular-nums">{value}</div>
        <div className="text-xs text-muted-foreground">{sub}</div>
      </CardContent>
    </Card>
  );
}
