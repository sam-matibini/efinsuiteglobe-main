import type { ReportData } from '@/components/reports/ReportActions';
import type { GstHstPeriodSnapshot } from '@/lib/gstHstPeriodEngine';
import type { TaxDetailGroup } from '@/lib/taxPeriodReport';
import { buildGstHstQbDetail, buildGstHstQbSummary, formatQbPeriodHeading } from '@/lib/gstHstStatement';

function blank(count: number): string[] {
  return Array.from({ length: count }, () => '');
}

function fmtNull(formatCurrency: (value: number) => string, value: number | null | undefined): string {
  if (value === null || value === undefined) return '';
  return formatCurrency(value);
}

export function buildGstHstSummaryShareData(input: {
  organizationName?: string | null;
  snapshot: GstHstPeriodSnapshot;
  formatCurrency: (value: number) => string;
}): ReportData {
  const { snapshot, formatCurrency } = input;
  const lines = buildGstHstQbSummary(snapshot);
  return {
    title: 'GST/HST Summary Report',
    subtitle: 'Accrual Basis · RST working copy',
    organizationName: input.organizationName || undefined,
    dateRange: formatQbPeriodHeading(snapshot.periodStart, snapshot.periodEnd),
    headers: ['Line description', 'Amount', 'Exception amount', 'Total line amount', 'Balance'],
    rows: lines.map((line) => [
      line.description,
      fmtNull(formatCurrency, line.amount),
      fmtNull(formatCurrency, line.exceptionAmount),
      fmtNull(formatCurrency, line.totalLineAmount),
      fmtNull(formatCurrency, line.balance),
    ]),
    totals: [
      { label: 'Sales and other revenue (line 101)', value: formatCurrency(snapshot.line101) },
      { label: 'GST/HST collected (line 103)', value: formatCurrency(snapshot.gstHstCollected) },
      { label: 'Input tax credits (line 106)', value: formatCurrency(snapshot.itc) },
      { label: 'Net tax (line 109)', value: formatCurrency(snapshot.netTax) },
    ],
  };
}

export function buildGstHstDetailShareData(input: {
  organizationName?: string | null;
  snapshot: GstHstPeriodSnapshot;
  formatCurrency: (value: number) => string;
}): ReportData {
  const { snapshot, formatCurrency } = input;
  const groups = buildGstHstQbDetail(snapshot.supportRows);
  const rows: (string | number)[][] = [];
  for (const group of groups) {
    rows.push([`Line ${group.line} ${group.label}`, ...blank(7)]);
    for (const row of group.rows) {
      rows.push([
        row.date,
        row.type,
        row.number || '',
        row.description,
        row.name || '',
        row.taxCode,
        formatCurrency(row.taxableAmount),
        formatCurrency(row.taxAmount),
      ]);
    }
  }
  return {
    title: 'GST/HST Detail Report',
    subtitle: 'Accrual Basis · RST transaction listing',
    organizationName: input.organizationName || undefined,
    dateRange: formatQbPeriodHeading(snapshot.periodStart, snapshot.periodEnd),
    headers: ['Date', 'Type', '#', 'Description', 'Name', 'Tax code', 'Net amount', 'Tax amount'],
    rows,
    totals: [
      { label: 'GST/HST collected (line 103)', value: formatCurrency(snapshot.gstHstCollected) },
      { label: 'Input tax credits (line 106)', value: formatCurrency(snapshot.itc) },
      { label: 'Net tax (line 109)', value: formatCurrency(snapshot.netTax) },
    ],
  };
}

function formatDetailDate(iso: string): string {
  if (!iso) return '';
  const [year, month, day] = iso.split('-').map(Number);
  if (!year || !month || !day) return iso;
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** QuickBooks-style Sales tax detail: transactions grouped by tax code. */
export function buildRstSalesTaxDetailShareData(input: {
  organizationName?: string | null;
  dateRange: string;
  formatCurrency: (value: number) => string;
  groups: TaxDetailGroup[];
}): ReportData {
  const { formatCurrency, groups } = input;
  const rows: (string | number)[][] = [];
  let taxableTotal = 0;
  let taxTotal = 0;
  const totals: { label: string; value: string | number }[] = [];

  for (const group of groups) {
    const countLabel = `${group.rows.length} ${group.rows.length === 1 ? 'transaction' : 'transactions'}`;
    rows.push([
      `${group.taxCode} (${countLabel})`,
      '',
      '',
      '',
      '',
      '',
      formatCurrency(group.taxableAmount),
      formatCurrency(group.taxAmount),
    ]);
    totals.push({
      label: `${group.taxCode} tax amount (${countLabel})`,
      value: formatCurrency(group.taxAmount),
    });
    taxableTotal += group.taxableAmount;
    taxTotal += group.taxAmount;
    for (const row of group.rows) {
      rows.push([
        formatDetailDate(row.date),
        row.type,
        row.number || '',
        row.description,
        `${row.accountCode} ${row.accountName}`.trim(),
        row.taxCode,
        row.taxableAmount ? formatCurrency(row.taxableAmount) : '',
        formatCurrency(row.taxAmount),
      ]);
    }
  }

  totals.push({ label: 'Total taxable', value: formatCurrency(taxableTotal) });
  totals.push({ label: 'Total tax amount', value: formatCurrency(taxTotal) });

  return {
    title: 'Sales tax detail',
    subtitle: `QuickBooks-style tax liability detail grouped by tax code for ${input.dateRange}.`,
    organizationName: input.organizationName || undefined,
    dateRange: input.dateRange,
    headers: ['Date', 'Type', 'Number', 'Description', 'Account', 'Tax code', 'Taxable', 'Tax amount'],
    rows,
    totals,
  };
}

export interface RstShareMetricRow {
  label: string;
  current: number;
  comparisons: number[];
}

export interface RstShareFormLine {
  code: string;
  label: string;
  amount: number;
}

export interface RstShareTaxCodeRow {
  code: string;
  name: string;
  collected: number;
  paid: number;
  net: number;
}

export function buildRstPeriodShareData(input: {
  title: string;
  organizationName?: string | null;
  dateRange: string;
  formatCurrency: (value: number) => string;
  comparisonLabels?: string[];
  metrics: RstShareMetricRow[];
  formLines?: RstShareFormLine[];
  taxCodeRows?: RstShareTaxCodeRow[];
}): ReportData {
  const formatCurrency = input.formatCurrency;
  const labels = input.comparisonLabels ?? [];
  const headers = ['Metric', 'Current Period', ...labels];
  const valueCount = headers.length - 1;
  const rows: (string | number)[][] = [];

  if (input.metrics.length > 0) {
    rows.push(['Period Comparison', ...blank(valueCount)]);
    for (const metric of input.metrics) {
      rows.push([
        metric.label,
        formatCurrency(metric.current),
        ...labels.map((_, index) => formatCurrency(metric.comparisons[index] ?? 0)),
      ]);
    }
  }

  if (input.formLines?.length) {
    rows.push(['', ...blank(valueCount)]);
    rows.push(['Filing form', ...blank(valueCount)]);
    for (const line of input.formLines) {
      rows.push([`${line.code} ${line.label}`, formatCurrency(line.amount), ...blank(Math.max(0, valueCount - 1))]);
    }
  }

  if (input.taxCodeRows?.length) {
    rows.push(['', ...blank(valueCount)]);
    rows.push(['By tax code', ...blank(valueCount)]);
    for (const row of input.taxCodeRows) {
      rows.push([
        `${row.code} ${row.name}`.trim(),
        formatCurrency(row.net),
        ...blank(Math.max(0, valueCount - 1)),
      ]);
    }
  }

  const net = input.metrics.find((row) => /net tax|tax due|net payable/i.test(row.label));
  const collected = input.metrics.find((row) => /collected/i.test(row.label));
  const itc = input.metrics.find((row) => /input tax|itc|paid/i.test(row.label));
  const sales = input.metrics.find((row) => /taxable sales/i.test(row.label));

  return {
    title: input.title,
    subtitle: 'RST report · period activity',
    organizationName: input.organizationName || undefined,
    dateRange: input.dateRange,
    headers,
    rows,
    totals: [
      ...(sales ? [{ label: sales.label, value: formatCurrency(sales.current) }] : []),
      ...(collected ? [{ label: collected.label, value: formatCurrency(collected.current) }] : []),
      ...(itc ? [{ label: itc.label, value: formatCurrency(itc.current) }] : []),
      ...(net ? [{ label: net.label, value: formatCurrency(net.current) }] : []),
    ],
  };
}
