/**
 * Nigerian Tax Engine — admin dashboard.
 *
 * Configurable, effective-dated tax framework. Every rate, bracket, exemption,
 * and relief is loaded from the database. Nothing on this page is hard-coded.
 *
 * Tabs:
 *  - Definitions      : active tax definitions + current rate versions
 *  - WHT Services     : withholding service classifications
 *  - Ledger           : recent taxable transactions (drill to source JE)
 *  - Filings          : generate & submit period returns
 *  - Remittances      : post payments against filings, mark ledger remitted
 *  - Reports          : rollup by definition & month (unfiled / filed / remitted)
 *  - Exemptions       : org-scoped exemptions & reliefs
 */

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  buildFilingManifest,
  downloadManifest,
  submitFiling as submitFilingHelper,
  acknowledgeFiling,
  rejectFiling,
  type SubmissionMode,
} from '@/lib/ngTax/submission';

function toCsv(rows: any[], columns: { key: string; label: string }[]): string {
  const esc = (v: any) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = columns.map(c => esc(c.label)).join(',');
  const body = rows.map(r => columns.map(c => esc(r[c.key])).join(',')).join('\n');
  return head + '\n' + body;
}
function downloadCsv(name: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}


const categoryColors: Record<string, string> = {
  sales: 'bg-emerald-100 text-emerald-800',
  payroll: 'bg-sky-100 text-sky-800',
  withholding: 'bg-amber-100 text-amber-800',
  corporate: 'bg-purple-100 text-purple-800',
  levy: 'bg-slate-100 text-slate-800',
};

const statusColors: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700',
  ready: 'bg-blue-100 text-blue-700',
  submitted: 'bg-amber-100 text-amber-700',
  accepted: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-700',
  amended: 'bg-purple-100 text-purple-700',
  remitted: 'bg-emerald-100 text-emerald-700',
  pending: 'bg-slate-100 text-slate-700',
  computed: 'bg-blue-100 text-blue-700',
  filed: 'bg-amber-100 text-amber-700',
};

function fmtNaira(n: number | string | null | undefined) {
  const v = Number(n ?? 0);
  return `₦${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function firstOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}
function lastOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
}

export default function NigeriaTaxEngine() {
  const { organization } = useCurrentOrganization();
  const orgId = organization?.id ?? null;
  const today = new Date().toISOString().slice(0, 10);
  const qc = useQueryClient();

  const { data: defs, isLoading: defsLoading } = useQuery({
    queryKey: ['ng-tax-defs', orgId],
    queryFn: async () => {
      const q = supabase.from('ng_tax_definitions').select('*').eq('is_active', true).order('code');
      const { data } = orgId
        ? await q.or(`organization_id.eq.${orgId},organization_id.is.null`)
        : await q.is('organization_id', null);
      return data ?? [];
    },
  });

  const { data: versions } = useQuery({
    queryKey: ['ng-tax-versions'],
    queryFn: async () => {
      const { data } = await supabase
        .from('ng_tax_rate_versions')
        .select('*')
        .eq('is_active', true)
        .lte('effective_from', today)
        .order('effective_from', { ascending: false });
      return data ?? [];
    },
  });

  const { data: services } = useQuery({
    queryKey: ['ng-tax-services'],
    queryFn: async () => {
      const { data } = await supabase
        .from('ng_tax_service_classifications')
        .select('*')
        .eq('is_active', true)
        .order('code');
      return data ?? [];
    },
  });

  const { data: ledger } = useQuery({
    queryKey: ['ng-tax-ledger', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data } = await supabase
        .from('ng_tax_transaction_ledger')
        .select('*')
        .eq('organization_id', orgId!)
        .order('transaction_date', { ascending: false })
        .limit(100);
      return data ?? [];
    },
  });

  const { data: filings } = useQuery({
    queryKey: ['ng-tax-filings', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data } = await supabase
        .from('ng_tax_filings')
        .select('*')
        .eq('organization_id', orgId!)
        .order('period_end', { ascending: false })
        .limit(100);
      return data ?? [];
    },
  });

  const { data: remittances } = useQuery({
    queryKey: ['ng-tax-remittances', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data } = await supabase
        .from('ng_tax_remittances')
        .select('*')
        .eq('organization_id', orgId!)
        .order('payment_date', { ascending: false })
        .limit(100);
      return data ?? [];
    },
  });

  const { data: summary } = useQuery({
    queryKey: ['ng-tax-summary', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('ng_tax_ledger_summary')
        .select('*')
        .eq('organization_id', orgId!)
        .order('period_month', { ascending: false });
      return data ?? [];
    },
  });

  const { data: exemptions } = useQuery({
    queryKey: ['ng-tax-exemptions', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data } = await supabase
        .from('ng_tax_exemptions')
        .select('*')
        .eq('organization_id', orgId!)
        .order('effective_from', { ascending: false });
      return data ?? [];
    },
  });

  const { data: reliefs } = useQuery({
    queryKey: ['ng-tax-reliefs', orgId],
    queryFn: async () => {
      const q = supabase.from('ng_tax_reliefs').select('*').eq('is_active', true).order('code');
      const { data } = orgId
        ? await q.or(`organization_id.eq.${orgId},organization_id.is.null`)
        : await q.is('organization_id', null);
      return data ?? [];
    },
  });

  const { data: bankAccounts } = useQuery({
    queryKey: ['ng-tax-banks', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data } = await supabase
        .from('bank_accounts')
        .select('id,account_name,institution_name,currency_code')
        .eq('organization_id', orgId!)
        .eq('is_active', true)
        .order('account_name');
      return data ?? [];
    },
  });

  const { data: compliance } = useQuery({
    queryKey: ['ng-tax-compliance', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('ng_tax_compliance_dashboard')
        .select('*')
        .eq('organization_id', orgId!)
        .order('due_date');
      return data ?? [];
    },
  });

  const activeByDef = useMemo(() => {
    const m = new Map<string, any>();
    (versions ?? []).forEach((v: any) => {
      if (!m.has(v.definition_id)) m.set(v.definition_id, v);
    });
    return m;
  }, [versions]);

  const defById = useMemo(() => {
    const m = new Map<string, any>();
    (defs ?? []).forEach((d: any) => m.set(d.id, d));
    return m;
  }, [defs]);

  // ---- Filing generator dialog ----
  const [genOpen, setGenOpen] = useState(false);
  const [genDef, setGenDef] = useState<string>('');
  const [genStart, setGenStart] = useState<string>(firstOfMonth());
  const [genEnd, setGenEnd] = useState<string>(lastOfMonth());
  const [genForm, setGenForm] = useState<string>('');

  const generateFiling = useMutation({
    mutationFn: async () => {
      if (!orgId || !genDef) throw new Error('Select an organization and a tax definition');
      const { data, error } = await (supabase as any).rpc('ng_generate_filing', {
        p_organization_id: orgId,
        p_definition_id: genDef,
        p_period_start: genStart,
        p_period_end: genEnd,
        p_form_code: genForm || null,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      toast.success('Filing generated');
      setGenOpen(false);
      qc.invalidateQueries({ queryKey: ['ng-tax-filings', orgId] });
      qc.invalidateQueries({ queryKey: ['ng-tax-ledger', orgId] });
      qc.invalidateQueries({ queryKey: ['ng-tax-summary', orgId] });
    },
    onError: (e: any) => toast.error(e.message ?? 'Failed to generate filing'),
  });

  const submitFiling = useMutation({
    mutationFn: async ({ id, ref }: { id: string; ref: string }) => {
      const { error } = await (supabase as any).rpc('ng_submit_filing', {
        p_filing_id: id,
        p_confirmation_reference: ref || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Filing marked submitted');
      qc.invalidateQueries({ queryKey: ['ng-tax-filings', orgId] });
    },
    onError: (e: any) => toast.error(e.message ?? 'Failed'),
  });

  // ---- Remittance dialog ----
  const [remitOpen, setRemitOpen] = useState(false);
  const [remitFiling, setRemitFiling] = useState<any>(null);
  const [remitDate, setRemitDate] = useState<string>(today);
  const [remitBank, setRemitBank] = useState<string>('');
  const [remitRef, setRemitRef] = useState<string>('');

  const postRemittance = useMutation({
    mutationFn: async () => {
      if (!remitFiling) throw new Error('No filing selected');
      const { data, error } = await (supabase as any).rpc('ng_post_remittance', {
        p_filing_id: remitFiling.id,
        p_payment_date: remitDate,
        p_bank_account_id: remitBank || null,
        p_reference: remitRef || null,
        p_journal_entry_id: null,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      toast.success('Remittance posted');
      setRemitOpen(false);
      setRemitFiling(null);
      setRemitRef('');
      qc.invalidateQueries({ queryKey: ['ng-tax-filings', orgId] });
      qc.invalidateQueries({ queryKey: ['ng-tax-remittances', orgId] });
      qc.invalidateQueries({ queryKey: ['ng-tax-ledger', orgId] });
      qc.invalidateQueries({ queryKey: ['ng-tax-summary', orgId] });
    },
    onError: (e: any) => toast.error(e.message ?? 'Failed to post remittance'),
  });

  // ---- Traceability drawer ----
  const [traceRow, setTraceRow] = useState<any>(null);

  // ---- Exemption dialog ----
  const [exOpen, setExOpen] = useState(false);
  const [exDef, setExDef] = useState('');
  const [exScope, setExScope] = useState('customer');
  const [exFrom, setExFrom] = useState(today);
  const [exTo, setExTo] = useState('');
  const [exReason, setExReason] = useState('');
  const createExemption = useMutation({
    mutationFn: async () => {
      if (!orgId || !exDef) throw new Error('Select a tax definition');
      const { error } = await (supabase.from('ng_tax_exemptions') as any).insert({
        organization_id: orgId,
        definition_id: exDef,
        scope: exScope,
        effective_from: exFrom,
        effective_to: exTo || null,
        reason: exReason || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Exemption added');
      setExOpen(false); setExDef(''); setExReason(''); setExTo('');
      qc.invalidateQueries({ queryKey: ['ng-tax-exemptions', orgId] });
    },
    onError: (e: any) => toast.error(e.message ?? 'Failed'),
  });

  // ---- Reconciliation report ----
  const [reconStart, setReconStart] = useState<string>(firstOfMonth(new Date(new Date().getFullYear(), 0, 1)));
  const [reconEnd, setReconEnd] = useState<string>(lastOfMonth());
  const { data: recon, refetch: refetchRecon } = useQuery({
    queryKey: ['ng-tax-recon', orgId, reconStart, reconEnd],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('ng_get_reconciliation', {
        p_organization_id: orgId,
        p_period_start: reconStart,
        p_period_end: reconEnd,
      });
      if (error) throw error;
      return (data as any[]) ?? [];
    },
  });

  // ---- Submission dialog ----
  const [subOpen, setSubOpen] = useState(false);
  const [subFiling, setSubFiling] = useState<any>(null);
  const [subMode, setSubMode] = useState<SubmissionMode>('manifest');
  const [subRef, setSubRef] = useState('');

  const runSubmit = useMutation({
    mutationFn: async () => {
      if (!subFiling) throw new Error('No filing selected');
      const defCode = defById.get(subFiling.definition_id)?.code ?? 'NG-TAX';
      if (subMode === 'manifest') {
        const manifest = buildFilingManifest(subFiling, defCode);
        downloadManifest(manifest);
      }
      await submitFilingHelper({
        filingId: subFiling.id,
        mode: subMode,
        reference: subRef,
        payload: { definition_code: defCode, generated_at: new Date().toISOString() },
      });
    },
    onSuccess: () => {
      toast.success(subMode === 'manifest' ? 'Manifest downloaded and filing marked submitted' : 'Filing marked submitted');
      setSubOpen(false); setSubFiling(null); setSubRef(''); setSubMode('manifest');
      qc.invalidateQueries({ queryKey: ['ng-tax-filings', orgId] });
    },
    onError: (e: any) => toast.error(e.message ?? 'Submission failed'),
  });

  const ackFiling = useMutation({
    mutationFn: async ({ id, ref }: { id: string; ref: string }) => acknowledgeFiling(id, ref),
    onSuccess: () => {
      toast.success('Filing acknowledged');
      qc.invalidateQueries({ queryKey: ['ng-tax-filings', orgId] });
    },
    onError: (e: any) => toast.error(e.message ?? 'Failed'),
  });

  const rejFiling = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => rejectFiling(id, reason),
    onSuccess: () => {
      toast.success('Filing marked rejected');
      qc.invalidateQueries({ queryKey: ['ng-tax-filings', orgId] });
    },
    onError: (e: any) => toast.error(e.message ?? 'Failed'),
  });


  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Nigerian Tax Engine</h1>
        <p className="text-muted-foreground mt-1">
          Configurable, effective-dated tax framework. Every tax amount is traceable
          from the return back to the source transaction, journal entry, and
          remittance record.
        </p>
      </div>

      <Tabs defaultValue="compliance">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
          <TabsTrigger value="definitions">Definitions</TabsTrigger>
          <TabsTrigger value="wht">WHT Services</TabsTrigger>
          <TabsTrigger value="ledger">Ledger</TabsTrigger>
          <TabsTrigger value="filings">Filings</TabsTrigger>
          <TabsTrigger value="remittances">Remittances</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
          <TabsTrigger value="reconciliation">Reconciliation</TabsTrigger>
          <TabsTrigger value="exemptions">Exemptions &amp; Reliefs</TabsTrigger>
        </TabsList>

        {/* -------- COMPLIANCE DASHBOARD -------- */}
        <TabsContent value="compliance" className="space-y-4">
          {(() => {
            const rows: any[] = compliance ?? [];
            const overdue = rows.filter(r => r.urgency === 'overdue');
            const dueSoon = rows.filter(r => r.urgency === 'due_soon');
            const totalAccrued = rows.reduce((s, r) => s + Number(r.accrued_tax || 0), 0);
            const totalFiled = rows.reduce((s, r) => s + Number(r.filed_unremitted_tax || 0), 0);
            return (
              <>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <Card><CardHeader><CardTitle className="text-sm">Overdue filings</CardTitle></CardHeader>
                    <CardContent><div className="text-2xl font-bold text-red-600">{overdue.length}</div></CardContent></Card>
                  <Card><CardHeader><CardTitle className="text-sm">Due within 14 days</CardTitle></CardHeader>
                    <CardContent><div className="text-2xl font-bold text-amber-600">{dueSoon.length}</div></CardContent></Card>
                  <Card><CardHeader><CardTitle className="text-sm">Accrued (unfiled)</CardTitle></CardHeader>
                    <CardContent><div className="text-2xl font-bold">{fmtNaira(totalAccrued)}</div></CardContent></Card>
                  <Card><CardHeader><CardTitle className="text-sm">Filed, unremitted</CardTitle></CardHeader>
                    <CardContent><div className="text-2xl font-bold text-amber-700">{fmtNaira(totalFiled)}</div></CardContent></Card>
                </div>
                <Card>
                  <CardHeader><CardTitle>Upcoming &amp; Overdue Filings</CardTitle></CardHeader>
                  <CardContent>
                    {!orgId ? (
                      <p className="text-muted-foreground">Select an organization.</p>
                    ) : rows.length === 0 ? (
                      <p className="text-muted-foreground">No outstanding tax liabilities. Everything is filed and remitted.</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Urgency</TableHead>
                            <TableHead>Tax</TableHead>
                            <TableHead>Period</TableHead>
                            <TableHead>Due date</TableHead>
                            <TableHead className="text-right">Accrued</TableHead>
                            <TableHead className="text-right">Filed, unremitted</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {rows.map((r, i) => (
                            <TableRow key={`${r.definition_id}-${r.period_month}-${i}`}>
                              <TableCell>
                                <Badge className={
                                  r.urgency === 'overdue' ? 'bg-red-100 text-red-700'
                                    : r.urgency === 'due_soon' ? 'bg-amber-100 text-amber-700'
                                    : 'bg-slate-100 text-slate-700'
                                }>{r.urgency}</Badge>
                              </TableCell>
                              <TableCell className="font-mono text-xs">{r.definition_code}</TableCell>
                              <TableCell className="text-xs">{String(r.period_month).slice(0,7)}</TableCell>
                              <TableCell className="text-xs">{r.due_date}</TableCell>
                              <TableCell className="text-right">{fmtNaira(r.accrued_tax)}</TableCell>
                              <TableCell className="text-right text-amber-700">{fmtNaira(r.filed_unremitted_tax)}</TableCell>
                              <TableCell className="text-right">
                                <Button size="sm" variant="outline" onClick={() => {
                                  setGenDef(r.definition_id);
                                  setGenStart(String(r.period_month).slice(0,10));
                                  setGenEnd(r.period_end);
                                  setGenForm('');
                                  setGenOpen(true);
                                }}>Generate filing</Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </>
            );
          })()}
        </TabsContent>


        {/* -------- DEFINITIONS -------- */}
        <TabsContent value="definitions">
          <Card>
            <CardHeader><CardTitle>Active Tax Definitions</CardTitle></CardHeader>
            <CardContent>
              {defsLoading ? (
                <Skeleton className="h-40 w-full" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead><TableHead>Name</TableHead>
                      <TableHead>Category</TableHead><TableHead>Jurisdiction</TableHead>
                      <TableHead>Method</TableHead><TableHead>Current rate</TableHead>
                      <TableHead>Filing</TableHead><TableHead>Source</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(defs ?? []).map((d: any) => {
                      const v = activeByDef.get(d.id);
                      const rate =
                        v?.calculation_method === 'progressive' ? 'Progressive brackets'
                          : v?.calculation_method === 'tiered_turnover' ? 'Tiered by turnover'
                          : v?.rate != null ? `${v.rate}%` : '—';
                      return (
                        <TableRow key={d.id}>
                          <TableCell className="font-mono">{d.code}</TableCell>
                          <TableCell>{d.name}</TableCell>
                          <TableCell><Badge className={categoryColors[d.tax_category]}>{d.tax_category}</Badge></TableCell>
                          <TableCell>{d.jurisdiction_level}</TableCell>
                          <TableCell>{v?.calculation_method ?? '—'}</TableCell>
                          <TableCell className="font-medium">{rate}</TableCell>
                          <TableCell>{d.filing_frequency}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{v?.source_reference ?? '—'}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* -------- WHT SERVICES -------- */}
        <TabsContent value="wht">
          <Card>
            <CardHeader><CardTitle>Withholding Tax Service Classifications</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead><TableHead>Service</TableHead>
                    <TableHead className="text-right">Resident</TableHead>
                    <TableHead className="text-right">Non-resident</TableHead>
                    <TableHead className="text-right">Min threshold</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(services ?? []).map((s: any) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-mono">{s.code}</TableCell>
                      <TableCell>{s.name}</TableCell>
                      <TableCell className="text-right">{s.resident_rate}%</TableCell>
                      <TableCell className="text-right">{s.non_resident_rate != null ? `${s.non_resident_rate}%` : '—'}</TableCell>
                      <TableCell className="text-right">{s.min_threshold != null ? fmtNaira(s.min_threshold) : '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* -------- LEDGER -------- */}
        <TabsContent value="ledger">
          <Card>
            <CardHeader><CardTitle>Recent Tax Transactions</CardTitle></CardHeader>
            <CardContent>
              {!orgId ? (
                <p className="text-muted-foreground">Select an organization to view its ledger.</p>
              ) : (ledger?.length ?? 0) === 0 ? (
                <p className="text-muted-foreground">
                  No Nigerian tax transactions recorded yet. Amounts will appear here as
                  invoices, bills, and payroll runs are posted.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead><TableHead>Source</TableHead>
                      <TableHead>Definition</TableHead>
                      <TableHead className="text-right">Base</TableHead>
                      <TableHead className="text-right">Rate</TableHead>
                      <TableHead className="text-right">Tax</TableHead>
                      <TableHead>Status</TableHead><TableHead>JE</TableHead>
                      <TableHead>Filing</TableHead>
                      <TableHead className="text-right">Trace</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(ledger ?? []).map((l: any) => (
                      <TableRow key={l.id}>
                        <TableCell>{l.transaction_date}</TableCell>
                        <TableCell className="text-xs">{l.source_type}</TableCell>
                        <TableCell className="font-mono text-xs">{defById.get(l.definition_id)?.code ?? l.definition_id}</TableCell>
                        <TableCell className="text-right">{fmtNaira(l.taxable_base)}</TableCell>
                        <TableCell className="text-right">{l.tax_rate != null ? `${l.tax_rate}%` : '—'}</TableCell>
                        <TableCell className="text-right font-medium">{fmtNaira(l.tax_amount)}</TableCell>
                        <TableCell><Badge className={statusColors[l.status] ?? ''} variant="outline">{l.status}</Badge></TableCell>
                        <TableCell>
                          {l.journal_entry_id
                            ? <Link to={`/journal-entries?id=${l.journal_entry_id}`} className="text-primary underline text-xs">View JE</Link>
                            : <span className="text-muted-foreground text-xs">unlinked</span>}
                        </TableCell>
                        <TableCell className="text-xs font-mono">{l.filing_id ? l.filing_id.slice(0, 8) : '—'}</TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="ghost" onClick={() => setTraceRow(l)}>View</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* -------- FILINGS -------- */}
        <TabsContent value="filings">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Tax Filings</CardTitle>
              <Button onClick={() => setGenOpen(true)} disabled={!orgId}>Generate Filing</Button>
            </CardHeader>
            <CardContent>
              {!orgId ? (
                <p className="text-muted-foreground">Select an organization.</p>
              ) : (filings?.length ?? 0) === 0 ? (
                <p className="text-muted-foreground">No filings yet. Click <b>Generate Filing</b> to aggregate ledger rows into a return.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Period</TableHead><TableHead>Definition</TableHead>
                      <TableHead>Form</TableHead>
                      <TableHead className="text-right">Base</TableHead>
                      <TableHead className="text-right">Tax</TableHead>
                      <TableHead>Status</TableHead><TableHead>Confirmation</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(filings ?? []).map((f: any) => (
                      <TableRow key={f.id}>
                        <TableCell className="text-xs">{f.period_start} → {f.period_end}</TableCell>
                        <TableCell className="font-mono text-xs">{defById.get(f.definition_id)?.code ?? '—'}</TableCell>
                        <TableCell className="text-xs">{f.form_code ?? '—'}</TableCell>
                        <TableCell className="text-right">{fmtNaira(f.total_taxable_base)}</TableCell>
                        <TableCell className="text-right font-medium">{fmtNaira(f.total_tax)}</TableCell>
                        <TableCell><Badge className={statusColors[f.status] ?? ''}>{f.status}</Badge></TableCell>
                        <TableCell className="text-xs">{f.confirmation_reference ?? '—'}</TableCell>
                        <TableCell className="text-right space-x-2">
                          {f.status === 'ready' && (
                            <Button size="sm" variant="outline" onClick={() => {
                              setSubFiling(f); setSubMode('manifest'); setSubRef(''); setSubOpen(true);
                            }}>Submit</Button>
                          )}
                          {f.status === 'submitted' && (
                            <>
                              <Button size="sm" variant="outline" onClick={() => {
                                const ref = window.prompt('Authority acknowledgment reference:') ?? '';
                                ackFiling.mutate({ id: f.id, ref });
                              }}>Acknowledge</Button>
                              <Button size="sm" variant="outline" className="text-red-700" onClick={() => {
                                const reason = window.prompt('Rejection reason:') ?? '';
                                if (reason) rejFiling.mutate({ id: f.id, reason });
                              }}>Reject</Button>
                            </>
                          )}
                          {(f.status === 'submitted' || f.status === 'accepted' || f.status === 'ready') && (
                            <Button size="sm" onClick={() => {
                              setRemitFiling(f); setRemitOpen(true);
                              setRemitDate(today); setRemitBank(''); setRemitRef('');
                            }}>Remit</Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* -------- REMITTANCES -------- */}
        <TabsContent value="remittances">
          <Card>
            <CardHeader><CardTitle>Remittances</CardTitle></CardHeader>
            <CardContent>
              {!orgId ? (
                <p className="text-muted-foreground">Select an organization.</p>
              ) : (remittances?.length ?? 0) === 0 ? (
                <p className="text-muted-foreground">No remittances posted yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Payment date</TableHead><TableHead>Definition</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Reference</TableHead><TableHead>Status</TableHead>
                      <TableHead>JE</TableHead>
                      <TableHead>Receipt</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(remittances ?? []).map((r: any) => (
                      <TableRow key={r.id}>
                        <TableCell>{r.payment_date}</TableCell>
                        <TableCell className="font-mono text-xs">{defById.get(r.definition_id)?.code ?? '—'}</TableCell>
                        <TableCell className="text-right font-medium">{fmtNaira(r.amount)}</TableCell>
                        <TableCell className="text-xs">{r.reference ?? r.confirmation_reference ?? '—'}</TableCell>
                        <TableCell><Badge className={statusColors[r.status] ?? ''}>{r.status}</Badge></TableCell>
                        <TableCell>
                          {r.journal_entry_id
                            ? <Link to={`/journal-entries?id=${r.journal_entry_id}`} className="text-primary underline text-xs">View JE</Link>
                            : <span className="text-muted-foreground text-xs">—</span>}
                        </TableCell>
                        <TableCell>
                          <input
                            type="file"
                            accept="application/pdf,image/*"
                            className="text-xs w-40"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file || !orgId) return;
                              const path = `${orgId}/${r.id}/${Date.now()}-${file.name}`;
                              const up = await supabase.storage.from('ng-tax-receipts').upload(path, file, { upsert: true });
                              if (up.error) { toast.error(up.error.message); return; }
                              const { error } = await (supabase.from('ng_tax_remittances') as any)
                                .update({ receipt_storage_path: path, receipt_uploaded_at: new Date().toISOString() })
                                .eq('id', r.id);
                              if (error) { toast.error(error.message); return; }
                              toast.success('Receipt uploaded');
                              qc.invalidateQueries({ queryKey: ['ng-tax-remittances', orgId] });
                            }}
                          />
                          {r.receipt_storage_path && (
                            <button
                              className="text-xs text-primary underline ml-2"
                              onClick={async () => {
                                const { data } = await supabase.storage.from('ng-tax-receipts')
                                  .createSignedUrl(r.receipt_storage_path, 300);
                                if (data?.signedUrl) window.open(data.signedUrl, '_blank');
                              }}
                            >view</button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* -------- REPORTS -------- */}
        <TabsContent value="reports">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Monthly Rollup by Tax Definition</CardTitle>
              <Button
                size="sm"
                variant="outline"
                disabled={!summary?.length}
                onClick={() => {
                  const csv = toCsv(summary ?? [], [
                    { key: 'period_month', label: 'Month' },
                    { key: 'definition_code', label: 'Definition' },
                    { key: 'tax_category', label: 'Category' },
                    { key: 'transaction_count', label: 'Txns' },
                    { key: 'total_taxable_base', label: 'Base' },
                    { key: 'total_tax', label: 'Total Tax' },
                    { key: 'unfiled_tax', label: 'Unfiled' },
                    { key: 'filed_tax', label: 'Filed' },
                    { key: 'remitted_tax', label: 'Remitted' },
                  ]);
                  downloadCsv(`ng-tax-rollup-${today}.csv`, csv);
                }}
              >Export CSV</Button>
            </CardHeader>

            <CardContent>
              {!orgId ? (
                <p className="text-muted-foreground">Select an organization.</p>
              ) : (summary?.length ?? 0) === 0 ? (
                <p className="text-muted-foreground">No ledger activity to summarise.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Month</TableHead><TableHead>Definition</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Txns</TableHead>
                      <TableHead className="text-right">Base</TableHead>
                      <TableHead className="text-right">Total tax</TableHead>
                      <TableHead className="text-right">Unfiled</TableHead>
                      <TableHead className="text-right">Filed</TableHead>
                      <TableHead className="text-right">Remitted</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(summary ?? []).map((s: any, i: number) => (
                      <TableRow key={`${s.definition_id}-${s.period_month}-${i}`}>
                        <TableCell className="text-xs">{String(s.period_month).slice(0, 7)}</TableCell>
                        <TableCell className="font-mono text-xs">{s.definition_code}</TableCell>
                        <TableCell><Badge className={categoryColors[s.tax_category]}>{s.tax_category}</Badge></TableCell>
                        <TableCell className="text-right">{s.transaction_count}</TableCell>
                        <TableCell className="text-right">{fmtNaira(s.total_taxable_base)}</TableCell>
                        <TableCell className="text-right font-medium">{fmtNaira(s.total_tax)}</TableCell>
                        <TableCell className="text-right text-slate-600">{fmtNaira(s.unfiled_tax)}</TableCell>
                        <TableCell className="text-right text-amber-700">{fmtNaira(s.filed_tax)}</TableCell>
                        <TableCell className="text-right text-emerald-700">{fmtNaira(s.remitted_tax)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* -------- EXEMPTIONS & RELIEFS -------- */}
        <TabsContent value="exemptions" className="space-y-4">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Organization Exemptions</CardTitle>
              <Button size="sm" onClick={() => setExOpen(true)} disabled={!orgId}>Add Exemption</Button>
            </CardHeader>

            <CardContent>
              {!orgId ? (
                <p className="text-muted-foreground">Select an organization.</p>
              ) : (exemptions?.length ?? 0) === 0 ? (
                <p className="text-muted-foreground">No exemptions configured for this organization.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Definition</TableHead><TableHead>Scope</TableHead>
                      <TableHead>Effective from</TableHead><TableHead>Effective to</TableHead>
                      <TableHead>Reason</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(exemptions ?? []).map((e: any) => (
                      <TableRow key={e.id}>
                        <TableCell className="font-mono text-xs">{defById.get(e.definition_id)?.code ?? '—'}</TableCell>
                        <TableCell>{e.scope}</TableCell>
                        <TableCell>{e.effective_from}</TableCell>
                        <TableCell>{e.effective_to ?? '—'}</TableCell>
                        <TableCell className="text-xs">{e.reason ?? '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Reliefs Catalogue</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead><TableHead>Name</TableHead>
                    <TableHead>Type</TableHead><TableHead>Effective from</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(reliefs ?? []).map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs">{r.code}</TableCell>
                      <TableCell>{r.name}</TableCell>
                      <TableCell><Badge variant="outline">{r.relief_type}</Badge></TableCell>
                      <TableCell>{r.effective_from}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        {/* -------- RECONCILIATION -------- */}
        <TabsContent value="reconciliation">
          <Card>
            <CardHeader className="flex-row items-center justify-between flex-wrap gap-2">
              <div>
                <CardTitle>Accrued vs Filed vs Remitted</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  Reconciles ledger accruals against submitted filings and posted remittances. Non-zero variances highlight open compliance items.
                </p>
              </div>
              <div className="flex items-end gap-2">
                <div>
                  <Label className="text-xs">From</Label>
                  <Input type="date" value={reconStart} onChange={e => setReconStart(e.target.value)} className="h-8 w-36" />
                </div>
                <div>
                  <Label className="text-xs">To</Label>
                  <Input type="date" value={reconEnd} onChange={e => setReconEnd(e.target.value)} className="h-8 w-36" />
                </div>
                <Button size="sm" variant="outline" onClick={() => refetchRecon()}>Refresh</Button>
                <Button size="sm" variant="outline" disabled={!recon?.length} onClick={() => {
                  const csv = toCsv(recon ?? [], [
                    { key: 'period_month', label: 'Month' },
                    { key: 'definition_code', label: 'Tax' },
                    { key: 'accrued_tax', label: 'Accrued' },
                    { key: 'filed_tax', label: 'Filed' },
                    { key: 'remitted_tax', label: 'Remitted' },
                    { key: 'filed_variance', label: 'Unfiled variance' },
                    { key: 'remit_variance', label: 'Unremitted variance' },
                  ]);
                  downloadCsv(`ng-tax-reconciliation-${today}.csv`, csv);
                }}>Export CSV</Button>
              </div>
            </CardHeader>
            <CardContent>
              {!orgId ? (
                <p className="text-muted-foreground">Select an organization.</p>
              ) : (recon?.length ?? 0) === 0 ? (
                <p className="text-muted-foreground">No ledger activity in the selected range.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Month</TableHead><TableHead>Tax</TableHead>
                      <TableHead className="text-right">Accrued</TableHead>
                      <TableHead className="text-right">Filed</TableHead>
                      <TableHead className="text-right">Remitted</TableHead>
                      <TableHead className="text-right">Unfiled</TableHead>
                      <TableHead className="text-right">Unremitted</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(recon ?? []).map((r: any, i: number) => {
                      const filedVar = Number(r.filed_variance || 0);
                      const remitVar = Number(r.remit_variance || 0);
                      return (
                        <TableRow key={`${r.definition_id}-${r.period_month}-${i}`}>
                          <TableCell className="text-xs">{String(r.period_month).slice(0,7)}</TableCell>
                          <TableCell className="font-mono text-xs">{r.definition_code}</TableCell>
                          <TableCell className="text-right">{fmtNaira(r.accrued_tax)}</TableCell>
                          <TableCell className="text-right text-amber-700">{fmtNaira(r.filed_tax)}</TableCell>
                          <TableCell className="text-right text-emerald-700">{fmtNaira(r.remitted_tax)}</TableCell>
                          <TableCell className={`text-right ${Math.abs(filedVar) > 0.01 ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>{fmtNaira(filedVar)}</TableCell>
                          <TableCell className={`text-right ${Math.abs(remitVar) > 0.01 ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>{fmtNaira(remitVar)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>

      {/* Generate filing dialog */}
      <Dialog open={genOpen} onOpenChange={setGenOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Generate Filing</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tax definition</Label>
              <Select value={genDef} onValueChange={setGenDef}>
                <SelectTrigger><SelectValue placeholder="Choose a tax" /></SelectTrigger>
                <SelectContent>
                  {(defs ?? []).map((d: any) => (
                    <SelectItem key={d.id} value={d.id}>{d.code} — {d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Period start</Label>
                <Input type="date" value={genStart} onChange={e => setGenStart(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Period end</Label>
                <Input type="date" value={genEnd} onChange={e => setGenEnd(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Form code (optional)</Label>
              <Input placeholder="e.g. VAT-Form-002, PAYE-H1" value={genForm} onChange={e => setGenForm(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGenOpen(false)}>Cancel</Button>
            <Button onClick={() => generateFiling.mutate()} disabled={generateFiling.isPending || !genDef}>
              {generateFiling.isPending ? 'Generating…' : 'Generate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remittance dialog */}
      <Dialog open={remitOpen} onOpenChange={setRemitOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Post Remittance</DialogTitle></DialogHeader>
          {remitFiling && (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                Filing <span className="font-mono">{remitFiling.id.slice(0, 8)}</span> · {defById.get(remitFiling.definition_id)?.code} ·
                <span className="font-medium ml-1">{fmtNaira(remitFiling.total_tax)}</span>
              </div>
              <div className="space-y-2">
                <Label>Payment date</Label>
                <Input type="date" value={remitDate} onChange={e => setRemitDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Bank account</Label>
                <Select value={remitBank} onValueChange={setRemitBank}>
                  <SelectTrigger><SelectValue placeholder="Choose a bank account" /></SelectTrigger>
                  <SelectContent>
                    {(bankAccounts ?? []).map((b: any) => (
                      <SelectItem key={b.id} value={b.id}>{b.account_name} — {b.institution_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Reference / receipt</Label>
                <Input placeholder="FIRS receipt no." value={remitRef} onChange={e => setRemitRef(e.target.value)} />
              </div>
              <p className="text-xs text-muted-foreground border-l-2 border-emerald-500 pl-2">
                A journal entry will be posted automatically: <b>Dr</b> tax liability, <b>Cr</b> selected bank —
                using the account mapping for this tax. Leave the bank blank to skip auto-posting.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemitOpen(false)}>Cancel</Button>
            <Button onClick={() => postRemittance.mutate()} disabled={postRemittance.isPending}>
              {postRemittance.isPending ? 'Posting…' : 'Post remittance'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Exemption dialog */}
      <Dialog open={exOpen} onOpenChange={setExOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Exemption</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tax definition</Label>
              <Select value={exDef} onValueChange={setExDef}>
                <SelectTrigger><SelectValue placeholder="Choose a tax" /></SelectTrigger>
                <SelectContent>
                  {(defs ?? []).map((d: any) => (
                    <SelectItem key={d.id} value={d.id}>{d.code} — {d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Scope</Label>
              <Select value={exScope} onValueChange={setExScope}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="customer">Customer</SelectItem>
                  <SelectItem value="vendor">Vendor</SelectItem>
                  <SelectItem value="item">Item / service</SelectItem>
                  <SelectItem value="organization">Whole organization</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Effective from</Label>
                <Input type="date" value={exFrom} onChange={e => setExFrom(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Effective to (optional)</Label>
                <Input type="date" value={exTo} onChange={e => setExTo(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Reason</Label>
              <Textarea value={exReason} onChange={e => setExReason(e.target.value)} placeholder="e.g. Diplomatic status, export sale, statutory exemption" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExOpen(false)}>Cancel</Button>
            <Button onClick={() => createExemption.mutate()} disabled={createExemption.isPending || !exDef}>
              {createExemption.isPending ? 'Saving…' : 'Save exemption'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Traceability drawer */}
      <Sheet open={!!traceRow} onOpenChange={(o) => !o && setTraceRow(null)}>
        <SheetContent className="w-[520px] sm:w-[640px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Tax ledger trace</SheetTitle>
          </SheetHeader>
          {traceRow && (
            <div className="mt-6 space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Definition</Label><div className="font-mono">{defById.get(traceRow.definition_id)?.code}</div></div>
                <div><Label className="text-xs">Date</Label><div>{traceRow.transaction_date}</div></div>
                <div><Label className="text-xs">Base</Label><div>{fmtNaira(traceRow.taxable_base)}</div></div>
                <div><Label className="text-xs">Rate</Label><div>{traceRow.tax_rate != null ? `${traceRow.tax_rate}%` : '—'}</div></div>
                <div><Label className="text-xs">Tax</Label><div className="font-medium">{fmtNaira(traceRow.tax_amount)}</div></div>
                <div><Label className="text-xs">Status</Label><div><Badge className={statusColors[traceRow.status] ?? ''}>{traceRow.status}</Badge></div></div>
              </div>

              <div>
                <Label className="text-xs">Source</Label>
                <div className="font-mono text-xs break-all">{traceRow.source_type} · {traceRow.source_id ?? '—'}</div>
                {traceRow.source_parent_id && (
                  <div className="text-xs text-muted-foreground">parent: {traceRow.source_parent_id}</div>
                )}
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Journal entry</Label>
                {traceRow.journal_entry_id
                  ? <Link to={`/journal-entries?id=${traceRow.journal_entry_id}`} className="text-primary underline text-xs">Open JE {traceRow.journal_entry_id.slice(0,8)}</Link>
                  : <div className="text-muted-foreground text-xs">Not linked</div>}
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Filing</Label>
                <div className="font-mono text-xs">{traceRow.filing_id ?? '—'}</div>
              </div>

              <div>
                <Label className="text-xs">Calculation breakdown</Label>
                <pre className="mt-1 text-xs bg-muted p-3 rounded overflow-x-auto">
{JSON.stringify(traceRow.breakdown, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
      {/* Submission dialog */}
      <Dialog open={subOpen} onOpenChange={setSubOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Submit Filing</DialogTitle></DialogHeader>
          {subFiling && (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                {defById.get(subFiling.definition_id)?.code} · {subFiling.period_start} → {subFiling.period_end} ·
                <span className="font-medium ml-1">{fmtNaira(subFiling.total_tax)}</span>
              </div>
              <div className="space-y-2">
                <Label>Submission mode</Label>
                <Select value={subMode} onValueChange={(v) => setSubMode(v as SubmissionMode)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manifest">Manifest (download CSV for portal upload)</SelectItem>
                    <SelectItem value="manual">Manual (already submitted outside system)</SelectItem>
                    <SelectItem value="api" disabled>Direct API (requires portal credentials)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Confirmation reference (optional)</Label>
                <Input placeholder="Portal receipt / manifest ID" value={subRef} onChange={e => setSubRef(e.target.value)} />
              </div>
              <p className="text-xs text-muted-foreground border-l-2 border-blue-500 pl-2">
                {subMode === 'manifest'
                  ? 'A CSV manifest will be downloaded and the filing marked submitted. Upload the CSV to the FIRS TaxProMax or State IRS portal.'
                  : 'The filing will be marked submitted. Enter the reference issued by the tax authority.'}
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubOpen(false)}>Cancel</Button>
            <Button onClick={() => runSubmit.mutate()} disabled={runSubmit.isPending}>
              {runSubmit.isPending ? 'Submitting…' : 'Submit'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}

