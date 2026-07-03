/**
 * Phase 14 — Tax Provisioning & Deferred Tax (ASC 740 / IAS 12).
 *
 * Five tabs:
 *   1. Periods         - list of provision periods, create new
 *   2. Computation     - per-period: book income → current + deferred tax
 *   3. Temp Differences - catalog of book-tax differences
 *   4. NOLs            - net operating loss carryforwards
 *   5. ETR Reconciliation - statutory → effective rate walk
 */
import { useMemo, useState } from 'react';
import { useEnabledModules } from '@/hooks/useEnabledModules';
import {
  useProvisionPeriods,
  useJurisdictionRates,
  useTemporaryDifferences,
  useProvisionDetail,
  useNolCarryforwards,
  computeProvision,
  buildEtrReconciliation,
} from '@/hooks/useTaxProvision';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Calculator, FileText, Trash2, TrendingDown } from 'lucide-react';
import type {
  ProvisionFramework,
  ProvisionPeriodType,
  TempDiffCategory,
  DifferenceType,
  AdjustmentType,
  JurisdictionType,
} from '@/lib/taxProvision/types';

const fmtMoney = (cents: number) =>
  (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
const fmtPct = (n: number) => `${(n * 100).toFixed(2)}%`;

export default function TaxProvision() {
  const { isReadOnly } = useEnabledModules();
  const periods = useProvisionPeriods();
  const rates = useJurisdictionRates();
  const tempDiffs = useTemporaryDifferences();
  const nols = useNolCarryforwards();

  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null);
  const detail = useProvisionDetail(selectedPeriodId);

  // Effective blended rate from primary statutory rates
  const blendedRate = useMemo(() => {
    const primary = (rates.data ?? []).filter((r) => r.is_primary);
    if (primary.length === 0) return 0.21; // default US federal
    return primary.reduce((s, r) => s + Number(r.statutory_rate), 0);
  }, [rates.data]);

  const selectedPeriod = useMemo(
    () => (periods.data ?? []).find((p) => p.id === selectedPeriodId),
    [periods.data, selectedPeriodId]
  );

  const computation = useMemo(() => {
    if (!selectedPeriod) return null;
    const movements = (detail.movements.data ?? []).map((m) => ({
      movement: m,
      tempDiff: (tempDiffs.data ?? []).find((td) => td.id === m.temp_diff_id)!,
    })).filter((x) => x.tempDiff);
    return computeProvision({
      pretaxBookIncomeCents: selectedPeriod.pretax_book_income_cents,
      blendedStatutoryRate: blendedRate,
      movements,
      adjustments: detail.adjustments.data ?? [],
    });
  }, [selectedPeriod, detail.movements.data, detail.adjustments.data, tempDiffs.data, blendedRate]);

  const etrLines = useMemo(() => {
    if (!computation) return [];
    return buildEtrReconciliation(computation, detail.adjustments.data ?? []);
  }, [computation, detail.adjustments.data]);

  return (
    <div className="container max-w-7xl py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Tax Provisioning</h1>
        <p className="text-muted-foreground mt-1">
          Corporate income tax provisioning, deferred tax assets / liabilities, and ETR
          reconciliation under ASC 740 / IAS 12 / ASPE 3465.
        </p>
      </div>

      <Tabs defaultValue="periods">
        <TabsList className="grid grid-cols-6 w-full">
          <TabsTrigger value="periods">Periods</TabsTrigger>
          <TabsTrigger value="computation">Computation</TabsTrigger>
          <TabsTrigger value="temp-diffs">Temp Differences</TabsTrigger>
          <TabsTrigger value="rates">Statutory Rates</TabsTrigger>
          <TabsTrigger value="nols">NOLs</TabsTrigger>
          <TabsTrigger value="etr">ETR Recon</TabsTrigger>
        </TabsList>

        {/* PERIODS */}
        <TabsContent value="periods" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Provision Periods</CardTitle>
                <CardDescription>Annual or interim tax provision computations.</CardDescription>
              </div>
              {!isReadOnly && <NewPeriodDialog onCreated={() => periods.refetch()} create={periods.create} />}
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Period</TableHead>
                    <TableHead>Framework</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Pre-tax Income</TableHead>
                    <TableHead className="text-right">Total Provision</TableHead>
                    <TableHead className="text-right">ETR</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(periods.data ?? []).map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <div className="font-medium">{p.period_label}</div>
                        <div className="text-xs text-muted-foreground">
                          {p.period_start} → {p.period_end}
                        </div>
                      </TableCell>
                      <TableCell><Badge variant="outline">{p.reporting_framework.toUpperCase()}</Badge></TableCell>
                      <TableCell><Badge>{p.status}</Badge></TableCell>
                      <TableCell className="text-right">{fmtMoney(p.pretax_book_income_cents)}</TableCell>
                      <TableCell className="text-right">{fmtMoney(p.total_tax_provision_cents)}</TableCell>
                      <TableCell className="text-right">{fmtPct(p.effective_tax_rate)}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => setSelectedPeriodId(p.id)}>
                          Open
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(periods.data ?? []).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                        No provision periods yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* COMPUTATION */}
        <TabsContent value="computation" className="space-y-4">
          {!selectedPeriod ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                Select a period from the Periods tab to view its computation.
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calculator className="h-5 w-5" />
                    {selectedPeriod.period_label} — Provision Computation
                  </CardTitle>
                  <CardDescription>
                    Blended statutory rate: {fmtPct(blendedRate)}
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-3">
                  <Stat label="Pre-tax Book Income" value={fmtMoney(computation?.pretaxBookIncome ?? 0)} />
                  <Stat label="Permanent Diffs" value={fmtMoney(computation?.permanentDiffs ?? 0)} />
                  <Stat label="Taxable Income" value={fmtMoney(computation?.taxableIncome ?? 0)} />
                  <Stat label="Current Tax Expense" value={fmtMoney(computation?.currentTax ?? 0)} />
                  <Stat label="Deferred Tax Expense" value={fmtMoney(computation?.deferredTax ?? 0)} />
                  <Stat label="Total Tax Provision" value={fmtMoney(computation?.totalProvision ?? 0)} highlight />
                  <Stat label="Effective Tax Rate" value={fmtPct(computation?.effectiveTaxRate ?? 0)} highlight />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Temporary Difference Movements</CardTitle>
                  {!isReadOnly && (
                    <AddMovementDialog
                      periodId={selectedPeriod.id}
                      tempDiffs={tempDiffs.data ?? []}
                      blendedRate={blendedRate}
                      upsertMovement={detail.upsertMovement}
                    />
                  )}
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Difference</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Opening</TableHead>
                        <TableHead className="text-right">Originating</TableHead>
                        <TableHead className="text-right">Reversing</TableHead>
                        <TableHead className="text-right">Closing</TableHead>
                        <TableHead className="text-right">DT Balance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(detail.movements.data ?? []).map((m) => {
                        const td = (tempDiffs.data ?? []).find((x) => x.id === m.temp_diff_id);
                        return (
                          <TableRow key={m.id}>
                            <TableCell>{td?.name ?? '—'}</TableCell>
                            <TableCell>
                              <Badge variant={td?.difference_type === 'taxable' ? 'destructive' : 'default'}>
                                {td?.difference_type}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">{fmtMoney(m.opening_balance_cents)}</TableCell>
                            <TableCell className="text-right">{fmtMoney(m.originating_cents)}</TableCell>
                            <TableCell className="text-right">{fmtMoney(m.reversing_cents)}</TableCell>
                            <TableCell className="text-right">{fmtMoney(m.closing_balance_cents)}</TableCell>
                            <TableCell className="text-right">{fmtMoney(m.deferred_tax_balance_cents)}</TableCell>
                          </TableRow>
                        );
                      })}
                      {(detail.movements.data ?? []).length === 0 && (
                        <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-4">No movements yet.</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Adjustments (Permanent / Discrete)</CardTitle>
                  {!isReadOnly && (
                    <AddAdjustmentDialog
                      periodId={selectedPeriod.id}
                      blendedRate={blendedRate}
                      addAdjustment={detail.addAdjustment}
                    />
                  )}
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead className="text-right">Tax Impact</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(detail.adjustments.data ?? []).map((a) => (
                        <TableRow key={a.id}>
                          <TableCell><Badge variant="outline">{a.adjustment_type.replace(/_/g, ' ')}</Badge></TableCell>
                          <TableCell>{a.description}</TableCell>
                          <TableCell className="text-right">{fmtMoney(a.amount_cents)}</TableCell>
                          <TableCell className="text-right">{fmtMoney(a.tax_impact_cents)}</TableCell>
                          <TableCell className="text-right">
                            {!isReadOnly && (
                              <Button size="sm" variant="ghost" onClick={() => detail.removeAdjustment.mutate(a.id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                      {(detail.adjustments.data ?? []).length === 0 && (
                        <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-4">No adjustments yet.</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* TEMP DIFFS */}
        <TabsContent value="temp-diffs" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Temporary Differences Catalog</CardTitle>
                <CardDescription>
                  Book–tax differences that reverse over time, generating deferred tax assets or liabilities.
                </CardDescription>
              </div>
              {!isReadOnly && <NewTempDiffDialog create={tempDiffs.create} />}
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(tempDiffs.data ?? []).map((td) => (
                    <TableRow key={td.id}>
                      <TableCell>
                        <div className="font-medium">{td.name}</div>
                        {td.description && <div className="text-xs text-muted-foreground">{td.description}</div>}
                      </TableCell>
                      <TableCell><Badge variant="outline">{td.category}</Badge></TableCell>
                      <TableCell>
                        <Badge variant={td.difference_type === 'taxable' ? 'destructive' : 'default'}>
                          {td.difference_type}
                        </Badge>
                      </TableCell>
                      <TableCell>{td.is_active ? '✓' : '—'}</TableCell>
                      <TableCell className="text-right">
                        {!isReadOnly && (
                          <Button size="sm" variant="ghost" onClick={() => tempDiffs.remove.mutate(td.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(tempDiffs.data ?? []).length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">No temporary differences yet.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* RATES */}
        <TabsContent value="rates" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Statutory Tax Rates</CardTitle>
                <CardDescription>
                  Federal, state, provincial, and foreign income tax rates. Rates marked “primary” are summed
                  to compute the blended statutory rate used in current-tax calculations.
                </CardDescription>
              </div>
              {!isReadOnly && <NewRateDialog create={rates.create} />}
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Jurisdiction</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Country</TableHead>
                    <TableHead className="text-right">Rate</TableHead>
                    <TableHead>Effective</TableHead>
                    <TableHead>Primary</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(rates.data ?? []).map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.jurisdiction_name}</TableCell>
                      <TableCell><Badge variant="outline">{r.jurisdiction_type}</Badge></TableCell>
                      <TableCell>{r.country_code}{r.region_code ? ` / ${r.region_code}` : ''}</TableCell>
                      <TableCell className="text-right">{(Number(r.statutory_rate) * 100).toFixed(2)}%</TableCell>
                      <TableCell className="text-xs">{r.effective_from} → {r.effective_to ?? '∞'}</TableCell>
                      <TableCell>{r.is_primary ? '✓' : '—'}</TableCell>
                      <TableCell className="text-right">
                        {!isReadOnly && (
                          <Button size="sm" variant="ghost" onClick={() => rates.remove.mutate(r.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* NOLs */}
        <TabsContent value="nols" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Net Operating Loss Carryforwards</CardTitle>
                <CardDescription>Track NOLs by origin year, jurisdiction, and remaining balance.</CardDescription>
              </div>
              {!isReadOnly && <NewNolDialog create={nols.create} />}
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Year</TableHead>
                    <TableHead>Jurisdiction</TableHead>
                    <TableHead className="text-right">Original</TableHead>
                    <TableHead className="text-right">Utilized</TableHead>
                    <TableHead className="text-right">Remaining</TableHead>
                    <TableHead>Expiry</TableHead>
                    <TableHead className="text-right">Val. Allow.</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(nols.data ?? []).map((n) => (
                    <TableRow key={n.id}>
                      <TableCell>{n.origin_year}</TableCell>
                      <TableCell>{n.origin_jurisdiction}</TableCell>
                      <TableCell className="text-right">{fmtMoney(n.original_amount_cents)}</TableCell>
                      <TableCell className="text-right">{fmtMoney(n.utilized_amount_cents)}</TableCell>
                      <TableCell className="text-right">{fmtMoney(n.remaining_amount_cents)}</TableCell>
                      <TableCell>{n.is_indefinite ? 'Indefinite' : (n.expiry_date ?? '—')}</TableCell>
                      <TableCell className="text-right">{n.valuation_allowance_pct}%</TableCell>
                      <TableCell className="text-right">
                        {!isReadOnly && (
                          <Button size="sm" variant="ghost" onClick={() => nols.remove.mutate(n.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(nols.data ?? []).length === 0 && (
                    <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">No NOL carryforwards.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ETR */}
        <TabsContent value="etr" className="space-y-4">
          {!selectedPeriod ? (
            <Card><CardContent className="py-10 text-center text-muted-foreground">
              Select a period from the Periods tab to view its ETR reconciliation.
            </CardContent></Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingDown className="h-5 w-5" />
                  ETR Reconciliation — {selectedPeriod.period_label}
                </CardTitle>
                <CardDescription>Walk from statutory tax rate to effective tax rate.</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Tax $</TableHead>
                      <TableHead className="text-right">% of Pre-tax</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {etrLines.map((line, i) => (
                      <TableRow
                        key={i}
                        className={
                          line.line_type === 'effective'
                            ? 'font-bold border-t-2 border-primary'
                            : line.line_type === 'statutory'
                            ? 'font-semibold'
                            : ''
                        }
                      >
                        <TableCell>{line.description}</TableCell>
                        <TableCell className="text-right">{fmtMoney(line.amount_cents)}</TableCell>
                        <TableCell className="text-right">{line.rate_pct.toFixed(2)}%</TableCell>
                      </TableRow>
                    ))}
                    {etrLines.length === 0 && (
                      <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-4">No data.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------- Sub-components ---------- */

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`p-4 rounded-lg border ${highlight ? 'bg-primary/5 border-primary/30' : 'bg-muted/30'}`}>
      <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className={`text-xl font-semibold mt-1 ${highlight ? 'text-primary' : ''}`}>{value}</div>
    </div>
  );
}

function NewPeriodDialog({ create, onCreated }: { create: any; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    period_label: '',
    period_start: '',
    period_end: '',
    period_type: 'annual' as ProvisionPeriodType,
    reporting_framework: 'asc740' as ProvisionFramework,
    pretax_book_income: '',
    notes: '',
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="h-4 w-4 mr-1" /> New Period</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New Provision Period</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Label</Label><Input value={form.period_label} onChange={(e) => setForm({ ...form, period_label: e.target.value })} placeholder="FY 2026" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Start</Label><Input type="date" value={form.period_start} onChange={(e) => setForm({ ...form, period_start: e.target.value })} /></div>
            <div><Label>End</Label><Input type="date" value={form.period_end} onChange={(e) => setForm({ ...form, period_end: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Type</Label>
              <Select value={form.period_type} onValueChange={(v) => setForm({ ...form, period_type: v as ProvisionPeriodType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="annual">Annual</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="interim">Interim</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Framework</Label>
              <Select value={form.reporting_framework} onValueChange={(v) => setForm({ ...form, reporting_framework: v as ProvisionFramework })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="asc740">ASC 740 (US GAAP)</SelectItem>
                  <SelectItem value="ias12">IAS 12 (IFRS)</SelectItem>
                  <SelectItem value="aspe3465">ASPE 3465</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div><Label>Pre-tax Book Income (USD)</Label><Input type="number" value={form.pretax_book_income} onChange={(e) => setForm({ ...form, pretax_book_income: e.target.value })} /></div>
          <div><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          <Button
            className="w-full"
            onClick={async () => {
              await create.mutateAsync({
                period_label: form.period_label,
                period_start: form.period_start,
                period_end: form.period_end,
                period_type: form.period_type,
                reporting_framework: form.reporting_framework,
                pretax_book_income_cents: Math.round(parseFloat(form.pretax_book_income || '0') * 100),
                notes: form.notes || null,
              });
              setOpen(false);
              onCreated();
            }}
          >Create</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function NewTempDiffDialog({ create }: { create: any }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: '',
    category: 'depreciation' as TempDiffCategory,
    difference_type: 'taxable' as DifferenceType,
    description: '',
    is_active: true,
    gl_account_id: null as string | null,
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New Temporary Difference</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Depreciation: tax > book" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v as TempDiffCategory })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(['depreciation','accruals','reserves','deferred_revenue','nol','tax_credit','intangibles','other'] as TempDiffCategory[]).map((c) =>
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Type</Label>
              <Select value={form.difference_type} onValueChange={(v) => setForm({ ...form, difference_type: v as DifferenceType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="taxable">Taxable (DTL)</SelectItem>
                  <SelectItem value="deductible">Deductible (DTA)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <Button className="w-full" onClick={async () => { await create.mutateAsync(form); setOpen(false); }}>Create</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function NewRateDialog({ create }: { create: any }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    jurisdiction_name: '',
    jurisdiction_type: 'federal' as JurisdictionType,
    country_code: 'US',
    region_code: '',
    statutory_rate: '',
    effective_from: '',
    effective_to: '',
    is_primary: true,
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Rate</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New Statutory Rate</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Jurisdiction Name</Label><Input value={form.jurisdiction_name} onChange={(e) => setForm({ ...form, jurisdiction_name: e.target.value })} placeholder="US Federal" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Type</Label>
              <Select value={form.jurisdiction_type} onValueChange={(v) => setForm({ ...form, jurisdiction_type: v as JurisdictionType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(['federal','state','provincial','local','foreign'] as JurisdictionType[]).map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Country Code</Label><Input value={form.country_code} onChange={(e) => setForm({ ...form, country_code: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Region Code</Label><Input value={form.region_code} onChange={(e) => setForm({ ...form, region_code: e.target.value })} placeholder="CA, NY, ON…" /></div>
            <div><Label>Rate (decimal, e.g. 0.21)</Label><Input type="number" step="0.0001" value={form.statutory_rate} onChange={(e) => setForm({ ...form, statutory_rate: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Effective From</Label><Input type="date" value={form.effective_from} onChange={(e) => setForm({ ...form, effective_from: e.target.value })} /></div>
            <div><Label>Effective To</Label><Input type="date" value={form.effective_to} onChange={(e) => setForm({ ...form, effective_to: e.target.value })} /></div>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={form.is_primary} onChange={(e) => setForm({ ...form, is_primary: e.target.checked })} />
            <Label>Primary rate (used in blended calculation)</Label>
          </div>
          <Button
            className="w-full"
            onClick={async () => {
              await create.mutateAsync({
                jurisdiction_name: form.jurisdiction_name,
                jurisdiction_type: form.jurisdiction_type,
                country_code: form.country_code,
                region_code: form.region_code || null,
                statutory_rate: parseFloat(form.statutory_rate),
                effective_from: form.effective_from,
                effective_to: form.effective_to || null,
                is_primary: form.is_primary,
              });
              setOpen(false);
            }}
          >Create</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function NewNolDialog({ create }: { create: any }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    origin_year: new Date().getFullYear(),
    origin_jurisdiction: 'US Federal',
    original_amount: '',
    utilized_amount: '0',
    expiry_date: '',
    is_indefinite: true,
    valuation_allowance_pct: '0',
    notes: '',
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add NOL</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New NOL Carryforward</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Origin Year</Label><Input type="number" value={form.origin_year} onChange={(e) => setForm({ ...form, origin_year: parseInt(e.target.value) })} /></div>
            <div><Label>Jurisdiction</Label><Input value={form.origin_jurisdiction} onChange={(e) => setForm({ ...form, origin_jurisdiction: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Original Amount</Label><Input type="number" value={form.original_amount} onChange={(e) => setForm({ ...form, original_amount: e.target.value })} /></div>
            <div><Label>Already Utilized</Label><Input type="number" value={form.utilized_amount} onChange={(e) => setForm({ ...form, utilized_amount: e.target.value })} /></div>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={form.is_indefinite} onChange={(e) => setForm({ ...form, is_indefinite: e.target.checked })} />
            <Label>Indefinite carryforward</Label>
          </div>
          {!form.is_indefinite && <div><Label>Expiry Date</Label><Input type="date" value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} /></div>}
          <div><Label>Valuation Allowance (%)</Label><Input type="number" value={form.valuation_allowance_pct} onChange={(e) => setForm({ ...form, valuation_allowance_pct: e.target.value })} /></div>
          <div><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          <Button
            className="w-full"
            onClick={async () => {
              const orig = Math.round(parseFloat(form.original_amount || '0') * 100);
              const util = Math.round(parseFloat(form.utilized_amount || '0') * 100);
              await create.mutateAsync({
                origin_year: form.origin_year,
                origin_jurisdiction: form.origin_jurisdiction,
                original_amount_cents: orig,
                utilized_amount_cents: util,
                remaining_amount_cents: orig - util,
                expiry_date: form.is_indefinite ? null : (form.expiry_date || null),
                is_indefinite: form.is_indefinite,
                valuation_allowance_pct: parseFloat(form.valuation_allowance_pct || '0'),
                notes: form.notes || null,
              });
              setOpen(false);
            }}
          >Create</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AddMovementDialog({ periodId, tempDiffs, blendedRate, upsertMovement }: any) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    temp_diff_id: '',
    opening: '',
    originating: '',
    reversing: '',
    notes: '',
  });
  const opening = parseFloat(form.opening || '0');
  const orig = parseFloat(form.originating || '0');
  const rev = parseFloat(form.reversing || '0');
  const closing = opening + orig - rev;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Movement</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add Temp-Diff Movement</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Temporary Difference</Label>
            <Select value={form.temp_diff_id} onValueChange={(v) => setForm({ ...form, temp_diff_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
              <SelectContent>
                {tempDiffs.filter((t: any) => t.is_active).map((t: any) => (
                  <SelectItem key={t.id} value={t.id}>{t.name} ({t.difference_type})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Opening</Label><Input type="number" value={form.opening} onChange={(e) => setForm({ ...form, opening: e.target.value })} /></div>
            <div><Label>Originating</Label><Input type="number" value={form.originating} onChange={(e) => setForm({ ...form, originating: e.target.value })} /></div>
            <div><Label>Reversing</Label><Input type="number" value={form.reversing} onChange={(e) => setForm({ ...form, reversing: e.target.value })} /></div>
          </div>
          <div className="text-sm text-muted-foreground">
            Closing balance: <span className="font-semibold text-foreground">{fmtMoney(Math.round(closing * 100))}</span>
            {' · '}DT @ {fmtPct(blendedRate)}: <span className="font-semibold text-foreground">{fmtMoney(Math.round(closing * 100 * blendedRate))}</span>
          </div>
          <div><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          <Button
            className="w-full"
            onClick={async () => {
              const closingCents = Math.round(closing * 100);
              const openCents = Math.round(opening * 100);
              const dtClosing = Math.round(closingCents * blendedRate);
              const dtOpening = Math.round(openCents * blendedRate);
              await upsertMovement.mutateAsync({
                provision_period_id: periodId,
                temp_diff_id: form.temp_diff_id,
                opening_balance_cents: openCents,
                originating_cents: Math.round(orig * 100),
                reversing_cents: Math.round(rev * 100),
                closing_balance_cents: closingCents,
                applied_rate: blendedRate,
                deferred_tax_balance_cents: dtClosing,
                deferred_tax_movement_cents: dtClosing - dtOpening,
                notes: form.notes || null,
              });
              setOpen(false);
            }}
          >Save</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AddAdjustmentDialog({ periodId, blendedRate, addAdjustment }: any) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    adjustment_type: 'permanent_difference' as AdjustmentType,
    description: '',
    amount: '',
    tax_impact: '',
  });
  const amt = parseFloat(form.amount || '0');
  const autoImpact = Math.round(amt * 100 * blendedRate);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Adjustment</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New Adjustment</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Type</Label>
            <Select value={form.adjustment_type} onValueChange={(v) => setForm({ ...form, adjustment_type: v as AdjustmentType })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="permanent_difference">Permanent Difference</SelectItem>
                <SelectItem value="discrete_item">Discrete Item</SelectItem>
                <SelectItem value="tax_credit">Tax Credit</SelectItem>
                <SelectItem value="prior_year_adjustment">Prior-Year Adjustment</SelectItem>
                <SelectItem value="rate_change">Rate Change</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Description</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Meals 50% non-deductible" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Amount (book)</Label><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
            <div>
              <Label>Tax Impact (auto: {fmtMoney(autoImpact)})</Label>
              <Input type="number" value={form.tax_impact} onChange={(e) => setForm({ ...form, tax_impact: e.target.value })} placeholder="leave blank to auto-calc" />
            </div>
          </div>
          <Button
            className="w-full"
            onClick={async () => {
              const amtCents = Math.round(amt * 100);
              const taxCents = form.tax_impact ? Math.round(parseFloat(form.tax_impact) * 100) : autoImpact;
              await addAdjustment.mutateAsync({
                provision_period_id: periodId,
                adjustment_type: form.adjustment_type,
                description: form.description,
                amount_cents: amtCents,
                tax_impact_cents: taxCents,
                applied_rate: blendedRate,
              });
              setOpen(false);
            }}
          >Save</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
