/**
 * Phase 15 — Withholding Tax Engine (1099 / T4A / NR4 / WHT)
 *
 * Tabs:
 *   1. Dashboard       — YTD totals, slip readiness, upcoming remittances
 *   2. Regimes         — manage withholding regimes (1099, T4A, NR4, etc.)
 *   3. Vendor Profiles — TIN/W-9/W-8BEN status, treaty rates, exemptions
 *   4. Transactions    — withholding events recorded against bills/payments
 *   5. Year-End Slips  — generate, issue, and file 1099/T4A/NR4 slips
 *   6. Remittances     — periodic remittance tracking to authorities
 */
import { useMemo, useState } from 'react';
import { useEnabledModules } from '@/hooks/useEnabledModules';
import { useVendors } from '@/hooks/useVendors';
import {
  useWhtRegimes,
  useWhtVendorProfiles,
  useWhtTransactions,
  useWhtSlips,
  useWhtRemittances,
} from '@/hooks/useWithholding';
import { computeWithholding } from '@/lib/withholding/calculator';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Receipt, FileText, Sparkles, Send, Plus, Calculator, Globe } from 'lucide-react';

const fmt = (cents: number) =>
  (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

export default function WithholdingTax() {
  const { isReadOnly } = useEnabledModules();
  const regimes = useWhtRegimes();
  const profiles = useWhtVendorProfiles();
  const { vendors } = useVendors();
  const [year, setYear] = useState(new Date().getFullYear());
  const txs = useWhtTransactions(year);
  const slips = useWhtSlips(year);
  const rems = useWhtRemittances();

  const ytdPaid = useMemo(
    () => (txs.data ?? []).reduce((s, t) => s + t.gross_amount_cents, 0),
    [txs.data],
  );
  const ytdWithheld = useMemo(
    () => (txs.data ?? []).reduce((s, t) => s + t.withheld_amount_cents, 0),
    [txs.data],
  );
  const slipsReady = (slips.data ?? []).filter((s) => s.status === 'draft').length;
  const slipsIssued = (slips.data ?? []).filter((s) => s.status === 'issued' || s.status === 'filed').length;

  const vendorById = useMemo(
    () => Object.fromEntries((vendors ?? []).map((v: any) => [v.id, v])),
    [vendors],
  );
  const regimeById = useMemo(
    () => Object.fromEntries((regimes.data ?? []).map((r) => [r.id, r])),
    [regimes.data],
  );

  return (
    <div className="container py-6 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Withholding Tax</h1>
          <p className="text-muted-foreground">1099 / T4A / NR4 / cross-border WHT compliance</p>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="wht-year" className="text-sm">Tax year</Label>
          <Input
            id="wht-year"
            type="number"
            className="w-24"
            value={year}
            onChange={(e) => setYear(Number(e.target.value) || year)}
          />
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardDescription>YTD Paid (subject to WHT)</CardDescription></CardHeader>
          <CardContent><div className="text-2xl font-semibold">{fmt(ytdPaid)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>YTD Withheld</CardDescription></CardHeader>
          <CardContent><div className="text-2xl font-semibold">{fmt(ytdWithheld)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>Slips ready (draft)</CardDescription></CardHeader>
          <CardContent><div className="text-2xl font-semibold">{slipsReady}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>Slips issued / filed</CardDescription></CardHeader>
          <CardContent><div className="text-2xl font-semibold">{slipsIssued}</div></CardContent>
        </Card>
      </div>

      <Tabs defaultValue="regimes" className="space-y-4">
        <TabsList>
          <TabsTrigger value="regimes"><Globe className="w-4 h-4 mr-2" />Regimes</TabsTrigger>
          <TabsTrigger value="profiles"><Receipt className="w-4 h-4 mr-2" />Vendor Profiles</TabsTrigger>
          <TabsTrigger value="transactions"><Calculator className="w-4 h-4 mr-2" />Transactions</TabsTrigger>
          <TabsTrigger value="slips"><FileText className="w-4 h-4 mr-2" />Year-End Slips</TabsTrigger>
          <TabsTrigger value="remittances"><Send className="w-4 h-4 mr-2" />Remittances</TabsTrigger>
        </TabsList>

        {/* REGIMES */}
        <TabsContent value="regimes" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Withholding Regimes</CardTitle>
                <CardDescription>1099-NEC, 1099-MISC, T4A, NR4, treaty WHT</CardDescription>
              </div>
              {!isReadOnly && (regimes.data ?? []).length === 0 && (
                <Button onClick={() => regimes.seedDefaults.mutate()}>
                  <Sparkles className="w-4 h-4 mr-2" /> Load defaults
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Country</TableHead>
                    <TableHead>Authority</TableHead>
                    <TableHead className="text-right">Rate</TableHead>
                    <TableHead className="text-right">Threshold</TableHead>
                    <TableHead>Box</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(regimes.data ?? []).map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono">{r.code}</TableCell>
                      <TableCell>{r.name}</TableCell>
                      <TableCell><Badge variant="outline">{r.country_code}</Badge></TableCell>
                      <TableCell>{r.authority}</TableCell>
                      <TableCell className="text-right">{(Number(r.default_rate) * 100).toFixed(2)}%</TableCell>
                      <TableCell className="text-right">{fmt(r.threshold_cents)}</TableCell>
                      <TableCell className="font-mono text-xs">{r.box_code ?? '—'}</TableCell>
                    </TableRow>
                  ))}
                  {(regimes.data ?? []).length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No regimes configured. Load defaults to start.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* VENDOR PROFILES */}
        <TabsContent value="profiles" className="space-y-4">
          <VendorProfilesTab
            profiles={profiles.data ?? []}
            vendors={vendors ?? []}
            regimes={regimes.data ?? []}
            onSave={(row) => profiles.upsert.mutate(row)}
            isReadOnly={isReadOnly}
          />
        </TabsContent>

        {/* TRANSACTIONS */}
        <TabsContent value="transactions" className="space-y-4">
          <TransactionsTab
            transactions={txs.data ?? []}
            vendorById={vendorById}
            regimeById={regimeById}
            regimes={regimes.data ?? []}
            profiles={profiles.data ?? []}
            year={year}
            onCreate={(row) => txs.create.mutate(row)}
            isReadOnly={isReadOnly}
          />
        </TabsContent>

        {/* SLIPS */}
        <TabsContent value="slips" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Year-End Slips · {year}</CardTitle>
                <CardDescription>Aggregated from withholding transactions</CardDescription>
              </div>
              {!isReadOnly && (
                <Button onClick={() => slips.generateForYear.mutate({ year, regimes: regimes.data ?? [] })}>
                  <Sparkles className="w-4 h-4 mr-2" /> Generate slips for {year}
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Slip type</TableHead>
                    <TableHead className="text-right">Total paid</TableHead>
                    <TableHead className="text-right">Withheld</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Issued</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(slips.data ?? []).map((s) => {
                    const v = vendorById[s.vendor_id];
                    return (
                      <TableRow key={s.id}>
                        <TableCell>{v?.name ?? s.vendor_id.slice(0, 8)}</TableCell>
                        <TableCell><Badge>{s.slip_type}</Badge></TableCell>
                        <TableCell className="text-right">{fmt(s.total_paid_cents)}</TableCell>
                        <TableCell className="text-right">{fmt(s.total_withheld_cents)}</TableCell>
                        <TableCell><Badge variant={s.status === 'draft' ? 'secondary' : 'default'}>{s.status}</Badge></TableCell>
                        <TableCell>{s.issued_date ?? '—'}</TableCell>
                        <TableCell className="text-right">
                          {!isReadOnly && s.status === 'draft' && (
                            <Button size="sm" variant="outline" onClick={() => slips.issueSlip.mutate(s.id)}>
                              Issue
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {(slips.data ?? []).length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No slips generated. Click "Generate slips" once you have transactions for {year}.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* REMITTANCES */}
        <TabsContent value="remittances" className="space-y-4">
          <RemittancesTab
            remittances={rems.data ?? []}
            regimes={regimes.data ?? []}
            onCreate={(row) => rems.create.mutate(row)}
            isReadOnly={isReadOnly}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ───────────────────── Vendor Profiles ───────────────────── */
function VendorProfilesTab({ profiles, vendors, regimes, onSave, isReadOnly }: any) {
  const [open, setOpen] = useState(false);
  const [vendorId, setVendorId] = useState('');
  const [regimeId, setRegimeId] = useState('');
  const [tinType, setTinType] = useState('EIN');
  const [tinLast4, setTinLast4] = useState('');
  const [taxFormType, setTaxFormType] = useState('W-9');
  const [treatyCountry, setTreatyCountry] = useState('');
  const [treatyRate, setTreatyRate] = useState('');
  const [isExempt, setIsExempt] = useState(false);

  const submit = () => {
    onSave({
      vendor_id: vendorId,
      regime_id: regimeId || null,
      tin_type: tinType,
      tin_last4: tinLast4 || null,
      tax_form_type: taxFormType,
      treaty_country: treatyCountry || null,
      treaty_rate: treatyRate ? Number(treatyRate) : null,
      is_exempt: isExempt,
    });
    setOpen(false);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Vendor Withholding Profiles</CardTitle>
          <CardDescription>TIN, tax forms (W-9/W-8BEN/NR301), treaty rates</CardDescription>
        </div>
        {!isReadOnly && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" />Add profile</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Vendor withholding profile</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Vendor</Label>
                  <Select value={vendorId} onValueChange={setVendorId}>
                    <SelectTrigger><SelectValue placeholder="Select vendor" /></SelectTrigger>
                    <SelectContent>
                      {vendors.map((v: any) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Regime</Label>
                  <Select value={regimeId} onValueChange={setRegimeId}>
                    <SelectTrigger><SelectValue placeholder="Select regime" /></SelectTrigger>
                    <SelectContent>
                      {regimes.map((r: any) => <SelectItem key={r.id} value={r.id}>{r.code} — {r.country_code}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>TIN type</Label>
                    <Select value={tinType} onValueChange={setTinType}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {['SSN','EIN','ITIN','SIN','BN','FOREIGN'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>TIN last 4</Label>
                    <Input value={tinLast4} onChange={(e) => setTinLast4(e.target.value)} maxLength={4} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Tax form</Label>
                    <Select value={taxFormType} onValueChange={setTaxFormType}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {['W-9','W-8BEN','W-8BEN-E','NR301','NONE'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Treaty country</Label>
                    <Input value={treatyCountry} onChange={(e) => setTreatyCountry(e.target.value)} placeholder="e.g. CA" />
                  </div>
                </div>
                <div>
                  <Label>Treaty rate (decimal, e.g. 0.10)</Label>
                  <Input type="number" step="0.01" value={treatyRate} onChange={(e) => setTreatyRate(e.target.value)} />
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox checked={isExempt} onCheckedChange={(c) => setIsExempt(c === true)} id="exempt" />
                  <Label htmlFor="exempt">Vendor is exempt from withholding</Label>
                </div>
              </div>
              <DialogFooter><Button onClick={submit} disabled={!vendorId}>Save</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vendor</TableHead>
              <TableHead>Regime</TableHead>
              <TableHead>TIN</TableHead>
              <TableHead>Tax form</TableHead>
              <TableHead>Treaty</TableHead>
              <TableHead className="text-right">YTD paid</TableHead>
              <TableHead className="text-right">YTD withheld</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {profiles.map((p: any) => {
              const v = vendors.find((x: any) => x.id === p.vendor_id);
              const r = regimes.find((x: any) => x.id === p.regime_id);
              return (
                <TableRow key={p.id}>
                  <TableCell>{v?.name ?? p.vendor_id.slice(0,8)}</TableCell>
                  <TableCell>{r?.code ?? '—'}</TableCell>
                  <TableCell className="font-mono">{p.tin_type ?? '—'} {p.tin_last4 ? `····${p.tin_last4}` : ''}</TableCell>
                  <TableCell>{p.tax_form_type ?? '—'}</TableCell>
                  <TableCell>{p.treaty_country ? `${p.treaty_country} @ ${(Number(p.treaty_rate ?? 0)*100).toFixed(1)}%` : '—'}</TableCell>
                  <TableCell className="text-right">{fmt(p.ytd_paid_cents)}</TableCell>
                  <TableCell className="text-right">{fmt(p.ytd_withheld_cents)}</TableCell>
                </TableRow>
              );
            })}
            {profiles.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No vendor profiles yet.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/* ───────────────────── Transactions / Sandbox ───────────────────── */
function TransactionsTab({ transactions, vendorById, regimeById, regimes, profiles, year, onCreate, isReadOnly }: any) {
  const [vendorId, setVendorId] = useState('');
  const [regimeId, setRegimeId] = useState('');
  const [gross, setGross] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  const regime = regimes.find((r: any) => r.id === regimeId);
  const profile = profiles.find((p: any) => p.vendor_id === vendorId);
  const grossCents = Math.round((Number(gross) || 0) * 100);
  const preview = computeWithholding({
    grossCents,
    regime: regime ?? null,
    vendorProfile: profile ?? null,
    ytdPaidCents: profile?.ytd_paid_cents ?? 0,
  });

  const record = () => {
    if (!vendorId || !regimeId || !grossCents) return;
    onCreate({
      vendor_id: vendorId,
      regime_id: regimeId,
      source_type: 'manual',
      source_id: null,
      transaction_date: date,
      tax_year: new Date(date).getFullYear(),
      gross_amount_cents: grossCents,
      withheld_amount_cents: preview.withheldCents,
      net_amount_cents: preview.netCents,
      applied_rate: preview.rate,
      currency_code: 'USD',
      journal_entry_id: null,
      status: 'recorded',
      notes: preview.reason,
    });
    setGross('');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle>Record withholding</CardTitle>
          <CardDescription>Live calculation preview</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Vendor</Label>
            <Select value={vendorId} onValueChange={setVendorId}>
              <SelectTrigger><SelectValue placeholder="Select vendor" /></SelectTrigger>
              <SelectContent>
                {Object.values(vendorById).map((v: any) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Regime</Label>
            <Select value={regimeId} onValueChange={setRegimeId}>
              <SelectTrigger><SelectValue placeholder="Select regime" /></SelectTrigger>
              <SelectContent>
                {regimes.map((r: any) => <SelectItem key={r.id} value={r.id}>{r.code}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Gross amount</Label>
            <Input type="number" step="0.01" value={gross} onChange={(e) => setGross(e.target.value)} />
          </div>
          <div>
            <Label>Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          <div className="rounded-md border p-3 bg-muted/40 text-sm space-y-1">
            <div className="flex justify-between"><span>Gross</span><span className="font-mono">{fmt(preview.grossCents)}</span></div>
            <div className="flex justify-between"><span>Rate</span><span className="font-mono">{(preview.rate * 100).toFixed(2)}%</span></div>
            <div className="flex justify-between"><span>Withheld</span><span className="font-mono text-destructive">{fmt(preview.withheldCents)}</span></div>
            <div className="flex justify-between font-semibold"><span>Net</span><span className="font-mono">{fmt(preview.netCents)}</span></div>
            <div className="text-xs text-muted-foreground pt-1">{preview.reason}</div>
          </div>

          {!isReadOnly && (
            <Button className="w-full" onClick={record} disabled={!vendorId || !regimeId || !grossCents}>
              Record transaction
            </Button>
          )}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Withholding transactions · {year}</CardTitle>
          <CardDescription>{transactions.length} records</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Regime</TableHead>
                <TableHead className="text-right">Gross</TableHead>
                <TableHead className="text-right">Rate</TableHead>
                <TableHead className="text-right">Withheld</TableHead>
                <TableHead className="text-right">Net</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((t: any) => (
                <TableRow key={t.id}>
                  <TableCell>{t.transaction_date}</TableCell>
                  <TableCell>{vendorById[t.vendor_id]?.name ?? t.vendor_id.slice(0,8)}</TableCell>
                  <TableCell><Badge variant="outline">{regimeById[t.regime_id]?.code ?? '—'}</Badge></TableCell>
                  <TableCell className="text-right font-mono">{fmt(t.gross_amount_cents)}</TableCell>
                  <TableCell className="text-right">{(Number(t.applied_rate)*100).toFixed(2)}%</TableCell>
                  <TableCell className="text-right font-mono text-destructive">{fmt(t.withheld_amount_cents)}</TableCell>
                  <TableCell className="text-right font-mono">{fmt(t.net_amount_cents)}</TableCell>
                </TableRow>
              ))}
              {transactions.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No transactions for {year}.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

/* ───────────────────── Remittances ───────────────────── */
function RemittancesTab({ remittances, regimes, onCreate, isReadOnly }: any) {
  const [open, setOpen] = useState(false);
  const [regimeId, setRegimeId] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [amount, setAmount] = useState('');

  const submit = () => {
    onCreate({
      regime_id: regimeId || null,
      period_start: periodStart,
      period_end: periodEnd,
      due_date: dueDate,
      total_withheld_cents: Math.round((Number(amount) || 0) * 100),
      remitted_amount_cents: 0,
      remittance_date: null,
      reference_number: null,
      status: 'open',
      journal_entry_id: null,
      notes: null,
    });
    setOpen(false);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Remittances</CardTitle>
          <CardDescription>Periodic submissions to tax authorities</CardDescription>
        </div>
        {!isReadOnly && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" />New remittance</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create remittance period</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Regime</Label>
                  <Select value={regimeId} onValueChange={setRegimeId}>
                    <SelectTrigger><SelectValue placeholder="Select regime" /></SelectTrigger>
                    <SelectContent>
                      {regimes.map((r: any) => <SelectItem key={r.id} value={r.id}>{r.code}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div><Label>Start</Label><Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} /></div>
                  <div><Label>End</Label><Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} /></div>
                  <div><Label>Due</Label><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
                </div>
                <div>
                  <Label>Total withheld for period</Label>
                  <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
                </div>
              </div>
              <DialogFooter><Button onClick={submit} disabled={!periodStart || !periodEnd || !dueDate}>Create</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Period</TableHead>
              <TableHead>Due</TableHead>
              <TableHead>Regime</TableHead>
              <TableHead className="text-right">Withheld</TableHead>
              <TableHead className="text-right">Remitted</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {remittances.map((r: any) => {
              const reg = regimes.find((x: any) => x.id === r.regime_id);
              return (
                <TableRow key={r.id}>
                  <TableCell>{r.period_start} → {r.period_end}</TableCell>
                  <TableCell>{r.due_date}</TableCell>
                  <TableCell>{reg?.code ?? '—'}</TableCell>
                  <TableCell className="text-right font-mono">{fmt(r.total_withheld_cents)}</TableCell>
                  <TableCell className="text-right font-mono">{fmt(r.remitted_amount_cents)}</TableCell>
                  <TableCell><Badge>{r.status}</Badge></TableCell>
                </TableRow>
              );
            })}
            {remittances.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No remittance periods yet.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
