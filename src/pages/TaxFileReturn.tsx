/**
 * TaxFileReturn — Phase 5
 * Preview a return-ready filing form for a tax filing period.
 * Supports CSV export and "Mark as Filed" (then optionally lock the period).
 */
import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import {
  ArrowLeft,
  Download,
  FileCheck,
  Lock,
  Loader2,
  Receipt,
  Building2,
  Send,
  Scale,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTaxFilingPeriods } from '@/hooks/useTaxFilingPeriods';
import { useTaxAuthorities } from '@/hooks/useTaxAuthorities';
import { useTaxReturnPreview } from '@/hooks/useTaxReturnPreview';
import { useIsReadOnly } from '@/hooks/useIsReadOnly';
import { toast } from 'sonner';

const CATEGORY_BADGE: Record<string, string> = {
  sales: 'bg-blue-500/15 text-blue-600',
  tax_collected: 'bg-primary/15 text-primary',
  itc: 'bg-emerald-500/15 text-emerald-600',
  net: 'bg-amber-500/15 text-amber-600',
  instalment: 'bg-muted text-foreground',
  adjustment: 'bg-muted text-muted-foreground',
  memo: 'bg-muted text-muted-foreground',
  rebate: 'bg-emerald-500/15 text-emerald-600',
  self_assess: 'bg-amber-500/15 text-amber-700',
};

function formatCurrency(value: number, currency: string) {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows
    .map((r) =>
      r
        .map((cell) => {
          const s = String(cell ?? '');
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(','),
    )
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function TaxFileReturn() {
  const { periodId } = useParams<{ periodId: string }>();
  const navigate = useNavigate();
  const readOnly = useIsReadOnly();

  const { authorities } = useTaxAuthorities();

  // Fetch the single filing period
  const { data: period, isLoading: periodLoading } = useQuery({
    queryKey: ['tax-filing-period', periodId],
    enabled: Boolean(periodId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tax_filing_periods')
        .select('*')
        .eq('id', periodId!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const authority = useMemo(
    () => authorities.find((a) => a.id === period?.tax_authority_id),
    [authorities, period],
  );

  // Country code from countries table
  const { data: country } = useQuery({
    queryKey: ['country', authority?.country_id],
    enabled: Boolean(authority?.country_id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('countries')
        .select('code')
        .eq('id', authority!.country_id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const previewInput = period && authority
    ? {
        periodId: period.id,
        periodStart: period.period_start,
        periodEnd: period.period_end,
        authorityId: authority.id,
        authorityName: authority.name,
        authorityRegion: authority.region,
        authorityCountryCode: country?.code ?? null,
        reportingCurrency: authority.reporting_currency,
      }
    : null;

  const { data: preview, isLoading: previewLoading } = useTaxReturnPreview(previewInput);
  const { markFiled, lockPeriod } = useTaxFilingPeriods(authority?.id);

  const loading = periodLoading || previewLoading;

  const handleExportCsv = () => {
    if (!preview) return;
    const rows: string[][] = [
      ['Form', preview.form.formCode],
      ['Form Name', preview.form.formName],
      ['Authority', preview.form.authority],
      ['Period', `${preview.form.periodStart} to ${preview.form.periodEnd}`],
      ['Currency', preview.form.currency],
      [],
      ['Line', 'Label', 'Formula', 'Amount'],
      ...preview.form.lines.map((l) => [
        l.code,
        l.label,
        l.formula ?? '',
        l.amount.toFixed(2),
      ]),
      [],
      ['Net Payable', '', '', preview.form.netPayable.toFixed(2)],
    ];
    downloadCsv(`${preview.form.formCode}_${preview.form.periodStart}_${preview.form.periodEnd}.csv`, rows);
  };

  const handleMarkFiled = async () => {
    if (!period) return;
    await markFiled.mutateAsync(period.id);
  };

  const handleLockPeriod = async () => {
    if (!period) return;
    await lockPeriod.mutateAsync(period.id);
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6 flex items-center justify-center min-h-[300px]">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!period || !authority) {
    return (
      <div className="container mx-auto p-6">
        <Button variant="ghost" onClick={() => navigate('/tax/filing-periods')}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>
        <Card className="mt-4">
          <CardContent className="p-6 text-muted-foreground">
            Filing period not found.
          </CardContent>
        </Card>
      </div>
    );
  }

  const form = preview?.form;
  const isFiled = period.status === 'filed' || period.status === 'locked' || period.status === 'paid';

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/tax/filing-periods')} className="mb-2">
            <ArrowLeft className="w-4 h-4 mr-2" /> Filing periods
          </Button>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Receipt className="w-7 h-7 text-primary" /> File Return
          </h1>
          <p className="text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
            <Building2 className="w-4 h-4" />
            <span className="font-medium text-foreground">{authority.name}</span>
            <span>·</span>
            <span>
              {format(parseISO(period.period_start), 'PP')} – {format(parseISO(period.period_end), 'PP')}
            </span>
            <Badge variant="outline" className="ml-2">{period.status}</Badge>
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={() => navigate(`/tax/reconciliation/${authority.id}`)}
            disabled={!form}
          >
            <Scale className="w-4 h-4 mr-2" /> Reconcile to GL
          </Button>
          <Button variant="outline" onClick={handleExportCsv} disabled={!form}>
            <Download className="w-4 h-4 mr-2" /> Export CSV
          </Button>
          <Button variant="outline" onClick={() => navigate('/tax/e-file')} disabled={!form}>
            <Send className="w-4 h-4 mr-2" /> E-File
          </Button>
          {!isFiled && (
            <Button onClick={handleMarkFiled} disabled={readOnly || !form || markFiled.isPending}>
              <FileCheck className="w-4 h-4 mr-2" /> Mark as Filed
            </Button>
          )}
          {period.status === 'filed' && (
            <Button variant="destructive" onClick={handleLockPeriod} disabled={readOnly || lockPeriod.isPending}>
              <Lock className="w-4 h-4 mr-2" /> Lock Period
            </Button>
          )}
        </div>
      </div>

      {form && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between flex-wrap gap-2">
                <span>{form.formName}</span>
                <Badge variant="secondary">{form.formCode}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">Line</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="w-40">Formula</TableHead>
                    <TableHead className="text-right w-40">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {form.lines.map((line) => (
                    <TableRow key={line.code}>
                      <TableCell className="font-mono">
                        <Badge className={CATEGORY_BADGE[line.category] ?? 'bg-muted'}>
                          {line.code}
                        </Badge>
                      </TableCell>
                      <TableCell>{line.label}</TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono">
                        {line.formula ?? '—'}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(line.amount, form.currency)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <Separator className="my-4" />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    {form.netPayable >= 0 ? 'Net amount owing' : 'Refund expected'}
                  </p>
                </div>
                <p
                  className={`text-2xl font-bold ${
                    form.netPayable >= 0 ? 'text-amber-600' : 'text-emerald-600'
                  }`}
                >
                  {formatCurrency(Math.abs(form.netPayable), form.currency)}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Source Detail</CardTitle>
            </CardHeader>
            <CardContent>
              {preview!.totals.rows.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No tax transactions recorded for this period.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Source</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead className="text-right">Rate</TableHead>
                      <TableHead className="text-right">Taxable</TableHead>
                      <TableHead className="text-right">Tax</TableHead>
                      <TableHead>Recoverable</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview!.totals.rows.slice(0, 200).map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="capitalize">{r.source}</TableCell>
                        <TableCell className="uppercase text-xs">{r.tax_type}</TableCell>
                        <TableCell className="text-xs font-mono">{r.tax_code ?? '—'}</TableCell>
                        <TableCell className="text-right">{(r.rate * 1).toFixed(2)}%</TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(r.taxable_amount, form.currency)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(r.tax_amount, form.currency)}
                        </TableCell>
                        <TableCell>
                          {r.is_recoverable ? (
                            <Badge variant="outline" className="text-emerald-600 border-emerald-500/40">
                              Yes
                            </Badge>
                          ) : (
                            <Badge variant="outline">No</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              {preview!.totals.rows.length > 200 && (
                <p className="text-xs text-muted-foreground mt-2">
                  Showing first 200 of {preview!.totals.rows.length} rows. Export CSV for the full detail.
                </p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
