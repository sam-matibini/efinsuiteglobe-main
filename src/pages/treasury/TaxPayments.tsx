import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useTaxPayments, TaxPaymentType, TaxPaymentMethod } from '@/hooks/useTaxPayments';
import { useTreasuryRails } from '@/hooks/useTreasuryRails';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useBankAccounts } from '@/hooks/useBankAccounts';
import { FundingBankSelect } from '@/components/treasury/FundingBankSelect';
import { CraAccountSelect } from '@/components/treasury/CraAccountSelect';
import { useCraAccounts, CraTaxType } from '@/hooks/useCraAccounts';
import { useIsReadOnly } from '@/hooks/useIsReadOnly';
import { Plus, Send, Trash2, Pencil, Mail } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useCountryTreasuryConfig } from '@/hooks/useCountryTreasuryConfig';

const TYPE_LABEL: Record<TaxPaymentType, string> = {
  source_deductions: 'CRA Source Deductions (PD7A)',
  gst_hst: 'GST/HST Remittance',
  corporate_tax: 'Corporate Income Tax',
  provision: 'Income Tax Provision',
  withholding: 'Withholding Tax',
  other: 'Other',
};

export default function TaxPayments() {
  const { payments, isLoading, create, updateStatus, update, remove, sendReceipt } = useTaxPayments();
  const { processTaxPayment } = useTreasuryRails();
  const { accounts: bankAccounts } = useBankAccounts();
  const isReadOnly = useIsReadOnly();
  const { config, countryCode } = useCountryTreasuryConfig();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ amount: string; period_start: string; period_end: string; payment_method: TaxPaymentMethod; notes: string; bank_account_id: string }>({
    amount: '', period_start: '', period_end: '', payment_method: 'cra_my_payment', notes: '', bank_account_id: '',
  });

  if (countryCode && countryCode !== 'CA') {
    const dest = countryCode === 'NG' ? '/tax/nigeria' : '/tax';
    return (
      <div className="p-6">
        <Card>
          <CardHeader><CardTitle>Not available for {config.displayName}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              This screen manages Canadian CRA remittances. For {config.displayName}, use the localized tax engine instead.
            </p>
            <Button asChild><a href={dest}>Open {config.displayName} Tax Engine</a></Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const openEdit = (p: typeof payments[number]) => {
    setEditId(p.id);
    setEditForm({
      amount: String(p.amount ?? ''),
      period_start: p.period_start ?? '',
      period_end: p.period_end ?? '',
      payment_method: p.payment_method,
      notes: p.notes ?? '',
      bank_account_id: p.bank_account_id ?? '',
    });
  };

  const saveEdit = async () => {
    if (!editId) return;
    await update.mutateAsync({
      id: editId,
      patch: {
        amount: Number(editForm.amount),
        period_start: editForm.period_start || null,
        period_end: editForm.period_end || null,
        payment_method: editForm.payment_method,
        notes: editForm.notes || null,
        bank_account_id: editForm.bank_account_id || null,
      },
    });
    setEditId(null);
  };

  const [form, setForm] = useState({
    payment_type: 'source_deductions' as TaxPaymentType,
    period_start: '',
    period_end: '',
    amount: '',
    currency: 'CAD',
    bank_account_id: '',
    cra_account_id: '',
    payment_method: 'cra_my_payment' as TaxPaymentMethod,
    notes: '',
    receipt_email: '',
    number_of_employees: '',
    gross_payroll: '',
    income_tax: '',
    cpp_employee: '',
    cpp_employer: '',
    ei_employee: '',
    ei_employer: '',
  });

  const craTaxType: CraTaxType | undefined =
    form.payment_type === 'gst_hst' ? 'gst_hst' :
    form.payment_type === 'source_deductions' ? 'payroll' :
    form.payment_type === 'corporate_tax' ? 'corporate_tax' : undefined;

  const { accounts: craAccounts } = useCraAccounts({ taxType: craTaxType });
  const selectedCra = craAccounts.find(a => a.id === form.cra_account_id);

  const duplicate = payments.find(p =>
    p.cra_account_id === form.cra_account_id &&
    p.period_end === (form.period_end || null) &&
    Math.abs(Number(p.amount) - Number(form.amount || 0)) < 0.01 &&
    p.status !== 'failed' && p.status !== 'cancelled' && p.status !== 'reversed'
  );

  const isPayroll = form.payment_type === 'source_deductions' && selectedCra?.program_code === 'RP';
  const pd7aSum = isPayroll
    ? Number(form.income_tax || 0) + Number(form.cpp_employee || 0) + Number(form.cpp_employer || 0)
      + Number(form.ei_employee || 0) + Number(form.ei_employer || 0)
    : null;
  const pd7aMismatch = isPayroll && form.amount && pd7aSum !== null
    ? Math.abs(Number(form.amount) - pd7aSum) > 0.02 : false;

  const submit = async () => {
    if (!form.amount || Number(form.amount) <= 0) return;
    if (pd7aMismatch) return;
    await create.mutateAsync({
      payment_type: form.payment_type,
      period_start: form.period_start || null,
      period_end: form.period_end || null,
      amount: Number(form.amount),
      currency: form.currency,
      bank_account_id: form.bank_account_id || null,
      payment_method: form.payment_method,
      notes: form.notes || (selectedCra ? `CRA ${selectedCra.full_account_number}` : null),
      cra_account_id: form.cra_account_id || null,
      receipt_email: form.receipt_email || null,
      ...(isPayroll ? {
        number_of_employees: form.number_of_employees ? Number(form.number_of_employees) : null,
        gross_payroll: form.gross_payroll ? Number(form.gross_payroll) : null,
        income_tax: form.income_tax ? Number(form.income_tax) : null,
        cpp_employee: form.cpp_employee ? Number(form.cpp_employee) : null,
        cpp_employer: form.cpp_employer ? Number(form.cpp_employer) : null,
        ei_employee: form.ei_employee ? Number(form.ei_employee) : null,
        ei_employer: form.ei_employer ? Number(form.ei_employer) : null,
      } : {}),
    });
    setOpen(false);
    setForm({ ...form, amount: '', notes: '', cra_account_id: '', receipt_email: '',
      number_of_employees: '', gross_payroll: '', income_tax: '',
      cpp_employee: '', cpp_employer: '', ei_employee: '', ei_employer: '' });
  };


  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Tax Payments</h1>
          <p className="text-muted-foreground">CRA source deductions, GST/HST, corporate tax and provisions</p>
        </div>
        {!isReadOnly && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" />Schedule Payment</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] flex flex-col">
              <DialogHeader><DialogTitle>Schedule Tax Payment</DialogTitle></DialogHeader>
              <div className="flex-1 overflow-y-auto space-y-3 pr-1 -mr-1">
                <div>
                  <Label>Payment Type</Label>
                  <Select value={form.payment_type} onValueChange={(v) => setForm({ ...form, payment_type: v as TaxPaymentType })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(TYPE_LABEL) as TaxPaymentType[]).map((k) => (
                        <SelectItem key={k} value={k}>{TYPE_LABEL[k]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label>Period start</Label><Input type="date" value={form.period_start} onChange={(e) => setForm({ ...form, period_start: e.target.value })} /></div>
                  <div><Label>Period end</Label><Input type="date" value={form.period_end} onChange={(e) => setForm({ ...form, period_end: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label>Amount</Label><Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
                  <div><Label>Currency</Label><Input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} /></div>
                </div>
                {craTaxType && (
                  <div>
                    <Label>CRA Program Account</Label>
                    <CraAccountSelect
                      taxType={craTaxType}
                      value={form.cra_account_id}
                      onValueChange={(v) => setForm({ ...form, cra_account_id: v })}
                    />
                  </div>
                )}
                {duplicate && (
                  <p className="text-xs text-destructive">
                    Possible duplicate of {duplicate.reference} ({duplicate.status}) for the same CRA account, period and amount.
                  </p>
                )}
                <div>
                  <Label>Funding Bank Account</Label>
                  <FundingBankSelect
                    value={form.bank_account_id}
                    onValueChange={(v) => setForm({ ...form, bank_account_id: v })}
                    requireRail={form.payment_method === 'stripe' || form.payment_method === 'plaid_ach' ? 'ach' : 'any'}
                  />
                </div>
                <div>
                  <Label>Method</Label>
                  <Select value={form.payment_method} onValueChange={(v) => setForm({ ...form, payment_method: v as TaxPaymentMethod })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cra_my_payment">CRA My Payment</SelectItem>
                      <SelectItem value="eft">EFT</SelectItem>
                      <SelectItem value="pad">Pre-Authorized Debit</SelectItem>
                      <SelectItem value="paysafe_card">Paysafe – Credit / Debit Visa</SelectItem>
                      <SelectItem value="paysafe_eft">Paysafe – EFT (CAD)</SelectItem>
                      <SelectItem value="paysafe_interac">Paysafe – Interac</SelectItem>
                      <SelectItem value="stripe">Stripe</SelectItem>
                      <SelectItem value="plaid_ach">Plaid ACH</SelectItem>
                      <SelectItem value="wire">Wire</SelectItem>
                      <SelectItem value="cheque">Cheque</SelectItem>
                      <SelectItem value="manual">Manual / Recorded</SelectItem>
                    </SelectContent>
                  </Select>
                  {form.payment_method === 'paysafe_card' && (
                    <p className="text-xs text-muted-foreground mt-1">Hosted card payout link – settles 1–2 business days. Funding bank is the settlement account.</p>
                  )}
                  {form.payment_method === 'paysafe_eft' && (
                    <p className="text-xs text-muted-foreground mt-1">Canadian EFT debit via Paysafe, 3–5 business days.</p>
                  )}
                  {form.payment_method === 'paysafe_interac' && (
                    <p className="text-xs text-muted-foreground mt-1">Interac e-Transfer via Paysafe, near real-time.</p>
                  )}
                </div>
                {isPayroll && (
                  <Card className="border-dashed">
                    <CardHeader className="pb-2"><CardTitle className="text-sm">Payroll Remittance (PD7A)</CardTitle></CardHeader>
                    <CardContent className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div><Label className="text-xs">Number of employees</Label><Input type="number" value={form.number_of_employees} onChange={(e) => setForm({ ...form, number_of_employees: e.target.value })} /></div>
                        <div><Label className="text-xs">Gross payroll</Label><Input type="number" step="0.01" value={form.gross_payroll} onChange={(e) => setForm({ ...form, gross_payroll: e.target.value })} /></div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div><Label className="text-xs">Income tax</Label><Input type="number" step="0.01" value={form.income_tax} onChange={(e) => setForm({ ...form, income_tax: e.target.value })} /></div>
                        <div />
                        <div><Label className="text-xs">CPP – employee</Label><Input type="number" step="0.01" value={form.cpp_employee} onChange={(e) => setForm({ ...form, cpp_employee: e.target.value })} /></div>
                        <div><Label className="text-xs">CPP – employer</Label><Input type="number" step="0.01" value={form.cpp_employer} onChange={(e) => setForm({ ...form, cpp_employer: e.target.value })} /></div>
                        <div><Label className="text-xs">EI – employee</Label><Input type="number" step="0.01" value={form.ei_employee} onChange={(e) => setForm({ ...form, ei_employee: e.target.value })} /></div>
                        <div><Label className="text-xs">EI – employer</Label><Input type="number" step="0.01" value={form.ei_employer} onChange={(e) => setForm({ ...form, ei_employer: e.target.value })} /></div>
                      </div>
                      <div className="flex justify-between text-xs pt-1 border-t">
                        <span className="text-muted-foreground">Sum of remittance lines</span>
                        <span className={pd7aMismatch ? 'text-destructive font-medium' : 'font-medium'}>
                          {(pd7aSum ?? 0).toFixed(2)} {form.currency}
                        </span>
                      </div>
                      {pd7aMismatch && (
                        <p className="text-xs text-destructive">Sum must equal Amount ({Number(form.amount).toFixed(2)}) within 2¢.</p>
                      )}
                    </CardContent>
                  </Card>
                )}
                <div>
                  <Label>Receipt email (optional)</Label>
                  <Input type="email" placeholder="payer@example.com" value={form.receipt_email} onChange={(e) => setForm({ ...form, receipt_email: e.target.value })} />
                  <p className="text-xs text-muted-foreground mt-1">A branded CRA confirmation receipt will be emailed when the payment is marked Paid.</p>
                </div>
                <div><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={submit} disabled={create.isPending}>Create</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card>
        <CardHeader><CardTitle>All Tax Payments</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <p>Loading…</p> : payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No payments yet. Click "Schedule Payment" to record a remittance.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs">{p.reference}</TableCell>
                    <TableCell>{TYPE_LABEL[p.payment_type]}</TableCell>
                    <TableCell className="text-xs">{p.period_start} → {p.period_end}</TableCell>
                    <TableCell className="text-right font-medium">{Number(p.amount).toFixed(2)} {p.currency}</TableCell>
                    <TableCell className="capitalize text-xs">{p.payment_method.replace(/_/g, ' ')}</TableCell>
                    <TableCell><Badge variant={p.status === 'paid' ? 'default' : p.status === 'failed' ? 'destructive' : 'secondary'}>{p.status}</Badge></TableCell>
                    <TableCell className="space-x-2">
                      {!isReadOnly && ['draft', 'scheduled', 'failed'].includes(p.status) && (
                        <Button size="sm" variant="outline" onClick={() => openEdit(p)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {!isReadOnly && (p.status === 'draft' || p.status === 'scheduled') && (
                        <Button size="sm" onClick={() => processTaxPayment.mutate({ tax_payment_id: p.id })} disabled={processTaxPayment.isPending}>
                          <Send className="h-3.5 w-3.5 mr-1" />Process
                        </Button>
                      )}
                      {!isReadOnly && p.status === 'submitted' && (
                        <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: p.id, status: 'paid' })}>Mark Paid</Button>
                      )}
                      {!isReadOnly && p.status === 'paid' && (
                        <Button size="sm" variant="outline" onClick={() => {
                          const email = window.prompt('Recipient email for the CRA confirmation receipt:');
                          if (email) sendReceipt.mutate({ id: p.id, recipient_email: email });
                        }} disabled={sendReceipt.isPending}>
                          <Mail className="h-3.5 w-3.5 mr-1" />Receipt
                        </Button>
                      )}
                      {!isReadOnly && ['draft', 'scheduled', 'failed', 'cancelled'].includes(p.status) && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="destructive" disabled={remove.isPending}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete payment {p.reference}?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This action cannot be undone. The payment record will be permanently removed.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => remove.mutate(p.id)}>Delete</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editId} onOpenChange={(o) => { if (!o) setEditId(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Tax Payment</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Amount</Label><Input type="number" step="0.01" value={editForm.amount} onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })} /></div>
              <div>
                <Label>Method</Label>
                <Select value={editForm.payment_method} onValueChange={(v) => setEditForm({ ...editForm, payment_method: v as TaxPaymentMethod })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cra_my_payment">CRA My Payment</SelectItem>
                    <SelectItem value="eft">EFT</SelectItem>
                    <SelectItem value="pad">Pre-Authorized Debit</SelectItem>
                    <SelectItem value="paysafe_card">Paysafe – Credit / Debit Visa</SelectItem>
                    <SelectItem value="paysafe_eft">Paysafe – EFT (CAD)</SelectItem>
                    <SelectItem value="paysafe_interac">Paysafe – Interac</SelectItem>
                    <SelectItem value="stripe">Stripe</SelectItem>
                    <SelectItem value="plaid_ach">Plaid ACH</SelectItem>
                    <SelectItem value="wire">Wire</SelectItem>
                    <SelectItem value="cheque">Cheque</SelectItem>
                    <SelectItem value="manual">Manual / Recorded</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Period start</Label><Input type="date" value={editForm.period_start} onChange={(e) => setEditForm({ ...editForm, period_start: e.target.value })} /></div>
              <div><Label>Period end</Label><Input type="date" value={editForm.period_end} onChange={(e) => setEditForm({ ...editForm, period_end: e.target.value })} /></div>
            </div>
            <div>
              <Label>Funding Bank Account</Label>
              <FundingBankSelect
                value={editForm.bank_account_id}
                onValueChange={(v) => setEditForm({ ...editForm, bank_account_id: v })}
                requireRail={editForm.payment_method === 'stripe' || editForm.payment_method === 'plaid_ach' ? 'ach' : 'any'}
              />
            </div>
            <div><Label>Notes</Label><Textarea value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditId(null)}>Cancel</Button>
            <Button onClick={saveEdit} disabled={update.isPending || !editForm.amount || Number(editForm.amount) <= 0}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
