/**
 * TaxReconciliation — compares GL income totals to GST/HST return lines
 * and highlights revenue posted without a tax code.
 */
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, CheckCircle2, Scale, Loader2, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { useTaxAuthorities } from '@/hooks/useTaxAuthorities';
import {
  useTaxReconciliation,
  ReconAccountRow,
} from '@/hooks/useTaxReconciliation';
import { format } from 'date-fns';
import { parseLocalDate } from '@/lib/utils';

type PeriodKey = 'ytd' | 'q1' | 'q2' | 'q3' | 'q4' | 'last_year';

function periodRange(key: PeriodKey, fyEndMonth: number | null): { start: string; end: string; label: string } {
  const today = new Date();
  const year = today.getFullYear();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  // Default to calendar-year if fiscal year end month is December (12) or null.
  const fyStartMonth = fyEndMonth ? ((fyEndMonth % 12) + 1) : 1; // month after FYE
  switch (key) {
    case 'ytd': {
      const start = new Date(year, fyStartMonth - 1, 1);
      if (start > today) start.setFullYear(year - 1);
      return { start: fmt(start), end: fmt(today), label: 'Fiscal YTD' };
    }
    case 'last_year': {
      return { start: `${year - 1}-01-01`, end: `${year - 1}-12-31`, label: `${year - 1} (calendar)` };
    }
    case 'q1':
      return { start: `${year}-01-01`, end: `${year}-03-31`, label: `Q1 ${year}` };
    case 'q2':
      return { start: `${year}-04-01`, end: `${year}-06-30`, label: `Q2 ${year}` };
    case 'q3':
      return { start: `${year}-07-01`, end: `${year}-09-30`, label: `Q3 ${year}` };
    case 'q4':
      return { start: `${year}-10-01`, end: `${year}-12-31`, label: `Q4 ${year}` };
  }
}

function fmtCur(n: number, currency = 'CAD') {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(n);
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
}

export default function TaxReconciliation() {
  const navigate = useNavigate();
  const { authorityId: routeAuthorityId } = useParams<{ authorityId?: string }>();
  const { organization } = useCurrentOrganization();
  const { authorities, isLoading: authLoading } = useTaxAuthorities();

  const gstAuthorities = useMemo(
    () => authorities.filter((a) => /gst|hst/i.test(a.name) && a.is_active),
    [authorities],
  );

  const [authorityId, setAuthorityId] = useState<string | undefined>(
    routeAuthorityId ?? undefined,
  );
  const effectiveAuthorityId =
    authorityId ?? gstAuthorities[0]?.id ?? authorities[0]?.id;

  const authority = authorities.find((a) => a.id === effectiveAuthorityId);
  const currency = authority?.reporting_currency || organization?.currency || 'CAD';

  const [periodKey, setPeriodKey] = useState<PeriodKey>('ytd');
  const range = useMemo(
    () => periodRange(periodKey, organization?.fiscal_year_end_month ?? null),
    [periodKey, organization?.fiscal_year_end_month],
  );

  const { data, isLoading } = useTaxReconciliation({
    organizationId: organization?.id,
    authorityId: effectiveAuthorityId,
    periodStart: range.start,
    periodEnd: range.end,
  });

  const [drawerAccount, setDrawerAccount] = useState<ReconAccountRow | null>(null);

  const drilldownLines = useMemo(() => {
    if (!data || !drawerAccount) return [];
    return data.untaxedLines.filter((l) => l.account_id === drawerAccount.account_id);
  }, [data, drawerAccount]);

  const expectedDiff = data
    ? Math.round((data.glIncomeTotal - data.taxCodedSales) * 100) / 100
    : 0;
  const tied = data ? Math.abs(expectedDiff) < 0.01 : false;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-2">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
          </Button>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Scale className="w-7 h-7 text-primary" /> GST/HST ↔ GL Reconciliation
          </h1>
          <p className="text-muted-foreground mt-1">
            Compares General Ledger income to GST/HST return lines and highlights
            revenue posted without a tax code.
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 flex flex-wrap items-end gap-4">
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Authority</div>
            <Select
              value={effectiveAuthorityId}
              onValueChange={(v) => setAuthorityId(v)}
              disabled={authLoading || authorities.length === 0}
            >
              <SelectTrigger className="w-[260px]">
                <SelectValue placeholder="Select authority" />
              </SelectTrigger>
              <SelectContent>
                {authorities.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Period</div>
            <Select value={periodKey} onValueChange={(v) => setPeriodKey(v as PeriodKey)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ytd">Fiscal YTD</SelectItem>
                <SelectItem value="q1">Q1 (current year)</SelectItem>
                <SelectItem value="q2">Q2 (current year)</SelectItem>
                <SelectItem value="q3">Q3 (current year)</SelectItem>
                <SelectItem value="q4">Q4 (current year)</SelectItem>
                <SelectItem value="last_year">Last calendar year</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Range</div>
            <div className="text-sm font-mono">
              {format(parseLocalDate(range.start), 'PP')} – {format(parseLocalDate(range.end), 'PP')}
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading || !data ? (
        <Card><CardContent className="p-12 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent></Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <SummaryTile label="GL Income (base)" value={fmtCur(data.glIncomeTotal, currency)} />
            <SummaryTile label="Tax-coded Sales" value={fmtCur(data.taxCodedSales, currency)} />
            <SummaryTile
              label="Untaxed Revenue"
              value={fmtCur(data.untaxedRevenue, currency)}
              tone={Math.abs(data.untaxedRevenue) >= 0.01 ? 'warn' : 'ok'}
            />
            <SummaryTile
              label={`Expected vs Reported Tax${data.defaultRate ? ` @ ${data.defaultRate}%` : ''}`}
              value={`${fmtCur(data.expectedTaxAtDefaultRate, currency)} / ${fmtCur(data.reportedTaxCollected, currency)}`}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Reconciliation</span>
                {tied ? (
                  <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/40">
                    <CheckCircle2 className="w-3 h-3 mr-1" /> GL ties to tax-coded sales
                  </Badge>
                ) : (
                  <Badge className="bg-amber-500/15 text-amber-700 border-amber-500/40">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    Variance: {fmtCur(expectedDiff, currency)}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableBody>
                  <ReconRow label="GL income (line 101 source)" value={data.glIncomeTotal} currency={currency} />
                  <ReconRow label="Less: tax-coded taxable sales (lines 103/106 sales side)" value={-data.taxCodedSales} currency={currency} />
                  <ReconRow label="= Untaxed revenue (taxable accounts only)" value={data.untaxedRevenue} currency={currency} bold />
                </TableBody>
              </Table>
              <p className="text-xs text-muted-foreground mt-3">
                FX gain/loss excluded: {fmtCur(data.fxExcluded, currency)}.
                Tax-authority settlement entries are excluded from both sides
                automatically so the totals tie back to the Income Statement.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>By income account</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-32">Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="text-right">GL Net</TableHead>
                    <TableHead className="text-right">Tax-coded</TableHead>
                    <TableHead className="text-right">Untaxed</TableHead>
                    <TableHead className="text-right w-20">% coded</TableHead>
                    <TableHead className="w-44">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.byAccount.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                      No income activity for this period.
                    </TableCell></TableRow>
                  )}
                  {data.byAccount.map((r) => {
                    const pct = Math.abs(r.gl_net) >= 0.01
                      ? Math.round((r.taxed_net / r.gl_net) * 100)
                      : 0;
                    const hasUntaxed = Math.abs(r.untaxed_net) >= 0.01;
                    return (
                      <TableRow
                        key={r.account_id}
                        className={hasUntaxed ? 'cursor-pointer hover:bg-muted/40' : ''}
                        onClick={() => hasUntaxed && setDrawerAccount(r)}
                      >
                        <TableCell className="font-mono text-xs">{r.account_code}</TableCell>
                        <TableCell>{r.account_name}</TableCell>
                        <TableCell className="text-right font-mono">{fmtCur(r.gl_net, currency)}</TableCell>
                        <TableCell className="text-right font-mono">{fmtCur(r.taxed_net, currency)}</TableCell>
                        <TableCell className={`text-right font-mono ${hasUntaxed && !r.is_zero_or_exempt ? 'text-amber-700' : ''}`}>
                          {fmtCur(r.untaxed_net, currency)}
                        </TableCell>
                        <TableCell className="text-right">{pct}%</TableCell>
                        <TableCell>
                          {!hasUntaxed ? (
                            <Badge variant="outline" className="text-emerald-700 border-emerald-500/40">
                              Fully coded
                            </Badge>
                          ) : r.is_zero_or_exempt ? (
                            <Badge variant="outline">Zero-rated / exempt</Badge>
                          ) : (
                            <Badge className="bg-amber-500/15 text-amber-700 border-amber-500/40">
                              <AlertTriangle className="w-3 h-3 mr-1" /> Missing tax code
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      <Sheet open={!!drawerAccount} onOpenChange={(o) => !o && setDrawerAccount(null)}>
        <SheetContent className="sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              Untaxed lines · {drawerAccount?.account_code} {drawerAccount?.account_name}
            </SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            {drilldownLines.length === 0 ? (
              <p className="text-sm text-muted-foreground">No detailed lines to show.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {drilldownLines.map((l) => {
                    const link =
                      l.source_document_type === 'bank_transaction'
                        ? `/banking/transactions`
                        : l.source_document_type === 'invoice' && l.source_document_id
                          ? `/invoices/${l.source_document_id}`
                          : null;
                    return (
                      <TableRow key={l.id}>
                        <TableCell className="font-mono text-xs">
                          {format(parseLocalDate(l.entry_date), 'PP')}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{l.reference ?? '—'}</TableCell>
                        <TableCell className="text-xs">{l.description ?? '—'}</TableCell>
                        <TableCell className="text-right font-mono">
                          {fmtCur(l.amount, authority?.reporting_currency || 'CAD')}
                        </TableCell>
                        <TableCell>
                          {link && (
                            <Button asChild size="icon" variant="ghost">
                              <Link to={link}><ExternalLink className="w-4 h-4" /></Link>
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function SummaryTile({ label, value, tone }: { label: string; value: string; tone?: 'ok' | 'warn' }) {
  const color =
    tone === 'warn' ? 'text-amber-700' : tone === 'ok' ? 'text-emerald-700' : 'text-foreground';
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`mt-1 text-xl font-semibold font-mono ${color}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function ReconRow({
  label, value, currency, bold,
}: { label: string; value: number; currency: string; bold?: boolean }) {
  return (
    <TableRow>
      <TableCell className={bold ? 'font-semibold' : ''}>{label}</TableCell>
      <TableCell className={`text-right font-mono ${bold ? 'font-semibold' : ''}`}>
        {fmtCur(value, currency)}
      </TableCell>
    </TableRow>
  );
}
