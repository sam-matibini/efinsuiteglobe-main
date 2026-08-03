import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Copy, Trash2, X, ExternalLink, Link as LinkIcon, Mail, Zap } from 'lucide-react';
import { usePaymentLinks, PaymentLinkMethod, InstantMethod } from '@/hooks/usePaymentLinks';
import { useBankAccounts } from '@/hooks/useBankAccounts';
import { useInvoices } from '@/hooks/useInvoices';
import { useCustomers } from '@/hooks/useCustomers';
import { useIsReadOnly } from '@/hooks/useIsReadOnly';
import { useCountryScope } from '@/hooks/useCountryFilter';
import { getBankInstitutionsOnly, getMobileMoneyProviders } from '@/data/localizedBankingInstitutions';
import { toast } from 'sonner';
import { useConfirmDelete } from '@/hooks/useConfirmDelete';

const METHOD_LABEL: Record<PaymentLinkMethod, string> = {
  all: 'Card + EFT',
  any_card: 'Any card',
  credit_card: 'Credit Card',
  debit_card: 'Debit Card',
  visa_debit: 'Visa Debit',
  eft: 'EFT',
};


export default function PaymentLinks() {
  const confirmDelete = useConfirmDelete();
  const { links, isLoading, create, cancel, remove, resendEmail } = usePaymentLinks();
  const { accounts: bankAccounts = [] } = useBankAccounts();
  const { invoices = [] } = useInvoices() as { invoices?: Array<{ id: string; invoice_number: string; balance_due: number; status: string; customer_id?: string; total: number }> };
  const { customers = [] } = useCustomers() as { customers?: Array<{ id: string; name: string; email: string | null }> };
  const isReadOnly = useIsReadOnly();
  const { country: countryScope } = useCountryScope();
  const isNG = countryScope === 'NG';
  const ngBanks = useMemo(() => getBankInstitutionsOnly('NG'), []);
  const ngMobile = useMemo(() => getMobileMoneyProviders('NG'), []);

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'invoice' | 'adhoc'>('invoice');
  const lastBank = typeof window !== 'undefined' ? window.localStorage.getItem('pl_last_deposit_bank') ?? '' : '';
  const defaultCurrency = isNG ? 'NGN' : 'CAD';
  type NgPayout = 'none' | 'nibss' | 'bank' | 'mobile';
  const initialForm = {
    invoice_id: '',
    amount: '',
    currency: defaultCurrency,
    description: '',
    payment_method: 'all' as PaymentLinkMethod,
    create_invoice_on_payment: false,
    payer_name: '',
    payer_email: '',
    deposit_bank_account_id: lastBank,
    instant_payment: false,
    instant_method: 'interac_etransfer' as InstantMethod,
    // NG-specific payout fields
    ng_payout: 'none' as NgPayout,
    ng_bank_code: '',
    ng_account_number: '',
    ng_wallet_provider: '',
    ng_wallet_number: '',
  };
  const [form, setForm] = useState(initialForm);

  const openInvoices = useMemo(
    () => invoices.filter((i) => ['sent', 'partial', 'overdue', 'issued', 'final'].includes(i.status) && Number(i.balance_due) > 0),
    [invoices]
  );

  const selectedInv = openInvoices.find((i) => i.id === form.invoice_id);

  const reset = () => setForm(initialForm);

  const submit = async () => {
    const amount = mode === 'invoice' && selectedInv ? Number(form.amount || selectedInv.balance_due) : Number(form.amount);
    if (!amount || amount <= 0) {
      toast.error('Amount must be greater than zero');
      return;
    }
    if (mode === 'invoice' && !form.invoice_id) {
      toast.error('Select an invoice');
      return;
    }
    if (mode === 'invoice' && selectedInv && amount > Number(selectedInv.balance_due) + 0.01) {
      toast.error(`Amount exceeds balance due (${selectedInv.balance_due.toFixed(2)})`);
      return;
    }
    if (form.payer_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.payer_email)) {
      toast.error('Enter a valid payer email');
      return;
    }
    if (form.instant_payment && !form.instant_method) {
      toast.error('Choose an instant payment rail');
      return;
    }
    if (form.deposit_bank_account_id && typeof window !== 'undefined') {
      window.localStorage.setItem('pl_last_deposit_bank', form.deposit_bank_account_id);
    }

    // NG payout validation
    let ngPayoutMeta: Record<string, unknown> | null = null;
    if (isNG) {
      if (form.ng_payout === 'bank') {
        if (!form.ng_bank_code) { toast.error('Select a Nigerian bank'); return; }
        if (!/^\d{10}$/.test(form.ng_account_number)) { toast.error('Enter a valid 10-digit NUBAN account number'); return; }
        const bank = ngBanks.find((b) => b.code === form.ng_bank_code);
        ngPayoutMeta = { payout: { country: 'NG', method: 'bank', bank_code: form.ng_bank_code, bank_name: bank?.name ?? null, account_number: form.ng_account_number } };
      } else if (form.ng_payout === 'mobile') {
        if (!form.ng_wallet_provider) { toast.error('Select a mobile money provider'); return; }
        if (!/^\d{11}$/.test(form.ng_wallet_number)) { toast.error('Enter a valid 11-digit wallet / phone number'); return; }
        const prov = ngMobile.find((m) => m.code === form.ng_wallet_provider);
        ngPayoutMeta = { payout: { country: 'NG', method: 'mobile_money', provider_code: form.ng_wallet_provider, provider_name: prov?.name ?? null, wallet_number: form.ng_wallet_number } };
      } else if (form.ng_payout === 'nibss') {
        ngPayoutMeta = { payout: { country: 'NG', method: 'nibss' } };
      }
    }

    await create.mutateAsync({
      amount,
      currency: form.currency,
      description: mode === 'invoice' && selectedInv ? `Payment for invoice ${selectedInv.invoice_number}` : form.description || null,
      invoice_id: mode === 'invoice' ? form.invoice_id : null,
      customer_id: mode === 'invoice' && selectedInv ? (selectedInv.customer_id ?? null) : null,
      create_invoice_on_payment: mode === 'adhoc' ? form.create_invoice_on_payment : false,
      payment_method: form.payment_method,
      payer_name: form.payer_name || null,
      payer_email: form.payer_email || null,
      deposit_bank_account_id: form.deposit_bank_account_id || null,
      instant_payment: form.instant_payment,
      instant_method: form.instant_payment ? form.instant_method : null,
      metadata: ngPayoutMeta,
    });
    setOpen(false);
    reset();
  };

  const copyLink = (id: string) => {
    const url = `${window.location.origin}/pay/${id}`;
    navigator.clipboard.writeText(url);
    toast.success('Link copied to clipboard');
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Payment Links</h1>
          <p className="text-muted-foreground">Collect card or EFT payments from customers via shareable links</p>
        </div>
        {!isReadOnly && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" />New Payment Link</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Create Payment Link</DialogTitle></DialogHeader>
              <Tabs value={mode} onValueChange={(v) => setMode(v as 'invoice' | 'adhoc')}>
                <TabsList className="grid grid-cols-2 w-full">
                  <TabsTrigger value="invoice">Link to invoice</TabsTrigger>
                  <TabsTrigger value="adhoc">Ad-hoc / new</TabsTrigger>
                </TabsList>
                <TabsContent value="invoice" className="space-y-3 pt-3">
                  <div>
                    <Label>Invoice</Label>
                    <Select value={form.invoice_id} onValueChange={(v) => {
                      const inv = openInvoices.find((i) => i.id === v);
                      const cust = inv ? customers.find((c) => c.id === inv.customer_id) : undefined;
                      setForm({
                        ...form,
                        invoice_id: v,
                        amount: inv ? String(inv.balance_due) : '',
                        payer_name: cust?.name || form.payer_name,
                        payer_email: cust?.email || form.payer_email,
                      });
                    }}>
                      <SelectTrigger><SelectValue placeholder="Select an open invoice" /></SelectTrigger>
                      <SelectContent>
                        {openInvoices.length === 0 && (
                          <div className="px-3 py-2 text-xs text-muted-foreground">No open invoices</div>
                        )}
                        {openInvoices.map((i) => (
                          <SelectItem key={i.id} value={i.id}>
                            {i.invoice_number} — {Number(i.balance_due).toFixed(2)} due
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {selectedInv && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label>Amount to collect</Label>
                        <Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
                        <p className="text-xs text-muted-foreground mt-1">Max {Number(selectedInv.balance_due).toFixed(2)}</p>
                      </div>
                      <div><Label>Currency</Label><Input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} /></div>
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="adhoc" className="space-y-3 pt-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div><Label>Amount</Label><Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
                    <div><Label>Currency</Label><Input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} /></div>
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What is being paid for?" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch id="auto-inv" checked={form.create_invoice_on_payment} onCheckedChange={(c) => setForm({ ...form, create_invoice_on_payment: c })} />
                    <Label htmlFor="auto-inv" className="text-sm">Auto-create invoice on payment</Label>
                  </div>
                </TabsContent>
              </Tabs>
              <div>
                <Label>Accepted methods</Label>
                <Select value={form.payment_method} onValueChange={(v) => setForm({ ...form, payment_method: v as PaymentLinkMethod })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All methods (Card + EFT)</SelectItem>
                    <SelectItem value="any_card">Any card</SelectItem>
                    <SelectItem value="credit_card">Credit Card only</SelectItem>
                    <SelectItem value="debit_card">Debit Card only</SelectItem>
                    <SelectItem value="visa_debit">Visa Debit only</SelectItem>
                    <SelectItem value="eft">EFT (bank) only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {isNG && (
                <div className="rounded-md border p-3 space-y-3">
                  <div>
                    <Label className="text-sm font-medium">Default payout method</Label>
                    <p className="text-[11px] text-muted-foreground">Where the collected NGN funds should settle.</p>
                  </div>
                  <div className="inline-flex rounded-full bg-muted p-1 text-sm">
                    {[
                      { v: 'none',   label: 'None' },
                      { v: 'nibss',  label: 'NIBSS (NG)' },
                      { v: 'bank',   label: 'Bank' },
                      { v: 'mobile', label: 'Mobile Money' },
                    ].map((opt) => (
                      <button
                        key={opt.v}
                        type="button"
                        onClick={() => setForm({ ...form, ng_payout: opt.v as typeof form.ng_payout })}
                        className={`px-3 py-1 rounded-full transition ${form.ng_payout === opt.v ? 'bg-background shadow font-medium' : 'text-muted-foreground'}`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  {form.ng_payout === 'bank' && (
                    <div className="grid gap-2">
                      <div>
                        <Label>Bank Name</Label>
                        <Select value={form.ng_bank_code} onValueChange={(v) => setForm({ ...form, ng_bank_code: v })}>
                          <SelectTrigger><SelectValue placeholder="Search Nigerian bank…" /></SelectTrigger>
                          <SelectContent className="max-h-72">
                            {ngBanks.map((b) => (
                              <SelectItem key={b.code} value={b.code}>{b.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Account Number</Label>
                        <Input
                          inputMode="numeric"
                          maxLength={10}
                          placeholder="0123456789"
                          value={form.ng_account_number}
                          onChange={(e) => setForm({ ...form, ng_account_number: e.target.value.replace(/\D/g, '') })}
                        />
                        <p className="text-[11px] text-muted-foreground mt-1">10-digit NUBAN.</p>
                      </div>
                    </div>
                  )}

                  {form.ng_payout === 'mobile' && (
                    <div className="grid gap-2">
                      <div>
                        <Label>Mobile Money Provider</Label>
                        <Select value={form.ng_wallet_provider} onValueChange={(v) => setForm({ ...form, ng_wallet_provider: v })}>
                          <SelectTrigger><SelectValue placeholder="Select provider" /></SelectTrigger>
                          <SelectContent>
                            {ngMobile.map((m) => (
                              <SelectItem key={m.code} value={m.code}>{m.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Wallet / Phone Number</Label>
                        <Input
                          inputMode="numeric"
                          maxLength={11}
                          placeholder="08012345678"
                          value={form.ng_wallet_number}
                          onChange={(e) => setForm({ ...form, ng_wallet_number: e.target.value.replace(/\D/g, '') })}
                        />
                        <p className="text-[11px] text-muted-foreground mt-1">11-digit Nigerian mobile number.</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
              <div>
                <Label>Deposit bank account <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Select
                  value={form.deposit_bank_account_id}
                  onValueChange={(v) => setForm({ ...form, deposit_bank_account_id: v })}
                >
                  <SelectTrigger><SelectValue placeholder="Where should the funds be recorded?" /></SelectTrigger>
                  <SelectContent>
                    {bankAccounts.length === 0 && (
                      <div className="px-3 py-2 text-xs text-muted-foreground">No active bank accounts</div>
                    )}
                    {bankAccounts.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}{b.institution ? ` — ${b.institution}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground mt-1">A matching bank transaction is created here when the payment completes.</p>
              </div>
              <div className="rounded-md border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-amber-500" />
                    <Label htmlFor="instant" className="text-sm font-medium">Instant payment / transfer</Label>
                  </div>
                  <Switch
                    id="instant"
                    checked={form.instant_payment}
                    onCheckedChange={(c) => setForm({ ...form, instant_payment: c })}
                  />
                </div>
                {form.instant_payment && (
                  <>
                    <Select
                      value={form.instant_method}
                      onValueChange={(v) => setForm({ ...form, instant_method: v as InstantMethod })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="interac_etransfer">Interac e-Transfer (Request Money)</SelectItem>
                        <SelectItem value="card_instant_funding">Expedited card settlement (Paysafe Instant Funding)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-[11px] text-muted-foreground">
                      {form.instant_method === 'interac_etransfer'
                        ? 'Payer receives a Money Request — funds usually arrive within minutes from their Canadian bank.'
                        : 'Card funds settle same-day instead of T+1/T+2 (requires Paysafe Instant Funding on your account).'}
                    </p>
                  </>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 pt-2 border-t">
                <div>
                  <Label>Payer name</Label>
                  <Input value={form.payer_name} onChange={(e) => setForm({ ...form, payer_name: e.target.value })} placeholder="Optional" />
                </div>
                <div>
                  <Label>Payer email</Label>
                  <Input type="email" value={form.payer_email} onChange={(e) => setForm({ ...form, payer_email: e.target.value })} placeholder="If set, link is emailed" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={submit} disabled={create.isPending}>Create Link</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card>
        <CardHeader><CardTitle>All Payment Links</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <p>Loading…</p> : links.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <LinkIcon className="h-10 w-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No payment links yet. Create one to start collecting.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Invoice</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Methods</TableHead>
                  <TableHead>Deposit to</TableHead>
                  <TableHead>Paid on</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {links.map((l) => {
                  const bank = bankAccounts.find((b) => b.id === l.deposit_bank_account_id);
                  const inv = l.invoice_id ? invoices.find((i) => i.id === l.invoice_id) : undefined;
                  const paidOn = l.paid_at ? new Date(l.paid_at).toLocaleDateString() : null;
                  return (
                  <TableRow key={l.id}>
                    <TableCell className="font-mono text-xs">{l.reference}</TableCell>
                    <TableCell className="text-sm max-w-[240px] truncate">{l.description || (l.invoice_id ? 'Invoice payment' : '—')}</TableCell>
                    <TableCell className="text-xs">
                      {inv ? (
                        <a href={`/invoices?focus=${inv.id}`} className="text-primary hover:underline font-medium">
                          {inv.invoice_number}
                        </a>
                      ) : '—'}
                    </TableCell>
                    <TableCell className="text-right font-medium">{Number(l.amount).toFixed(2)} {l.currency}</TableCell>
                    <TableCell className="text-xs">
                      <div className="flex items-center gap-1">
                        {METHOD_LABEL[l.payment_method as PaymentLinkMethod] ?? l.payment_method}
                        {l.instant_payment && (
                          <Zap className="h-3 w-3 text-amber-500" aria-label={l.instant_method === 'interac_etransfer' ? 'Interac e-Transfer' : 'Instant Funding'} />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{bank?.name ?? '—'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{paidOn ?? '—'}</TableCell>
                    <TableCell>
                      <Badge variant={l.status === 'paid' ? 'default' : l.status === 'cancelled' || l.status === 'expired' ? 'destructive' : 'secondary'}>
                        {l.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="space-x-1">
                      {l.status === 'open' && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => copyLink(l.id)} title="Copy link">
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="outline" asChild title="Open">
                            <a href={`/pay/${l.id}`} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          </Button>
                          {!isReadOnly && l.payer_email && (
                            <Button size="sm" variant="outline" onClick={() => resendEmail.mutate(l.id)} title={`Resend to ${l.payer_email}`} disabled={resendEmail.isPending}>
                              <Mail className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {!isReadOnly && (
                            <Button size="sm" variant="outline" onClick={() => confirmDelete(() => cancel.mutate(l.id), { title: 'Cancel payment link?', confirmLabel: 'Cancel link' })} title="Cancel">
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </>
                      )}
                      {!isReadOnly && l.status !== 'paid' && (
                        <Button size="sm" variant="destructive" onClick={() => confirmDelete(() => remove.mutate(l.id), { title: 'Delete payment link?' })} title="Delete">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
