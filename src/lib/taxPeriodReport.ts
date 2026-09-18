/**
 * Period tax-liability report engine.
 *
 * Tax Reports must use activity inside the selected period (credits minus
 * debits on tax GLs), not lifetime `accounts.current_balance`. Remittances
 * to the tax authority are excluded by `get_tax_movements_by_code`.
 */
import {
  buildFilingForm,
  type FilingFormResult,
  type FilingMeta,
  type PeriodTaxRow,
  type PeriodTotals,
} from '@/lib/filings';

export type TaxReportCategory = 'gst' | 'pst' | 'all';
export type TaxAccountSide = 'collected' | 'paid';

export interface TaxMovementRow {
  tax_code_id?: string | null;
  code: string | null;
  name?: string | null;
  rate: number | null;
  tax_type: string | null;
  jurisdiction?: string | null;
  authority_id?: string | null;
  authority_name?: string | null;
  is_recoverable?: boolean | null;
  side: string;
  gl_account_id?: string | null;
  account_code?: string | null;
  account_name?: string | null;
  tax_amount: number | string;
  taxable_amount: number | string;
}

export type TaxDatePreset =
  | 'today'
  | 'this_week'
  | 'this_month'
  | 'last_month'
  | 'this_quarter'
  | 'last_quarter'
  | 'this_year'
  | 'last_year'
  | 'custom';

export const TAX_DATE_PRESET_OPTIONS: { value: TaxDatePreset; label: string; labelFr: string }[] = [
  { value: 'today', label: 'Today', labelFr: "Aujourd'hui" },
  { value: 'this_week', label: 'This Week', labelFr: 'Cette semaine' },
  { value: 'this_month', label: 'This Month', labelFr: 'Ce mois' },
  { value: 'last_month', label: 'Previous Month', labelFr: 'Mois précédent' },
  { value: 'this_quarter', label: 'This Quarter', labelFr: 'Ce trimestre' },
  { value: 'last_quarter', label: 'Previous Quarter', labelFr: 'Trimestre précédent' },
  { value: 'this_year', label: 'This Year', labelFr: 'Cette année' },
  { value: 'last_year', label: 'Previous Year', labelFr: 'Année précédente' },
  { value: 'custom', label: 'Custom', labelFr: 'Personnalisé' },
];

export interface JournalTaxLine {
  account_name: string;
  account_code?: string;
  debit: number;
  credit: number;
  tax_code?: string;
  entry_date?: string;
  description?: string;
  reference?: string;
  line_description?: string;
}

export interface TaxDetailRow {
  date: string;
  type: string;
  number: string;
  description: string;
  accountCode: string;
  accountName: string;
  taxCode: string;
  side: TaxAccountSide;
  taxAmount: number;
  taxableAmount: number;
}

export interface TaxDetailGroup {
  taxCode: string;
  rows: TaxDetailRow[];
  taxableAmount: number;
  taxAmount: number;
}

export interface TaxCodePeriodRow {
  code: string;
  name: string;
  rate: number;
  taxableAmount: number;
  taxCollected: number;
  itcClaimed: number;
  taxDue: number;
}

export interface TaxAccountPeriodRow {
  accountCode: string;
  accountName: string;
  side: TaxAccountSide;
  periodAmount: number;
}

export interface PeriodTaxSummary {
  taxableSales: number;
  taxCollected: number;
  itcClaimed: number;
  netPayable: number;
  byTaxCode: TaxCodePeriodRow[];
  byAccount: TaxAccountPeriodRow[];
  rows: PeriodTaxRow[];
  totals: PeriodTotals;
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Match get_tax_movements_by_code account-side rules. */
export function classifyTaxAccountName(name: string): TaxAccountSide | null {
  const n = (name || '').toLowerCase();
  if (!n) return null;
  if (
    n.includes('input') ||
    n.includes('itc') ||
    n.includes('déductible') ||
    n.includes('deductible') ||
    (n.includes('paid') && !n.includes('payable'))
  ) {
    return 'paid';
  }
  if (n.includes('payable') || n.includes('collected') || n.includes('collectée') || n.includes('collectee')) {
    return 'collected';
  }
  return null;
}

export function isProvincialTaxHaystack(value: string): boolean {
  const n = value.toLowerCase();
  return n.includes('pst') || n.includes('qst') || n.includes('rst') || n.includes('tvq');
}

export function isGstHstHaystack(value: string): boolean {
  const n = value.toLowerCase();
  return n.includes('gst') || n.includes('hst');
}

export function movementMatchesCategory(row: TaxMovementRow, category: TaxReportCategory): boolean {
  if (category === 'all') return true;
  const hay = `${row.code ?? ''} ${row.name ?? ''} ${row.tax_type ?? ''} ${row.account_name ?? ''} ${row.authority_name ?? ''}`;
  if (category === 'pst') return isProvincialTaxHaystack(hay);
  return isGstHstHaystack(hay) || !isProvincialTaxHaystack(hay);
}

export function normalizeMovementTaxType(row: TaxMovementRow): string {
  const code = String(row.code ?? '').toUpperCase();
  const authority = String(row.authority_name ?? '').toUpperCase();
  const account = String(row.account_name ?? '').toUpperCase();
  if (code.startsWith('HST') || authority.includes('HST') || account.includes('HST')) return 'hst';
  if (code.startsWith('GST') || authority.includes('GST') || account.includes('GST')) return 'gst';
  if (code.startsWith('QST') || authority.includes('QST') || account.includes('QST') || code.startsWith('TVQ')) return 'qst';
  if (code.startsWith('PST') || authority.includes('PST') || account.includes('PST') || code.startsWith('RST')) return 'pst';
  if (code.startsWith('VAT') || authority.includes('VAT') || account.includes('VAT') || account.includes('TVA')) return 'vat';
  const t = String(row.tax_type ?? '').toLowerCase();
  return t && t !== 'both' ? t : 'sales';
}

export function movementsToPeriodRows(
  movements: TaxMovementRow[],
  flags?: Map<string, { zr: boolean; ex: boolean }>,
): PeriodTaxRow[] {
  return movements.map((m) => {
    const flag = m.tax_code_id ? flags?.get(m.tax_code_id) : undefined;
    return {
      source: m.side === 'collected' ? 'invoice' : 'bill',
      tax_type: normalizeMovementTaxType(m),
      tax_code: m.code ?? null,
      authority: m.authority_name ?? null,
      jurisdiction_code: m.jurisdiction ?? null,
      rate: Number(m.rate ?? 0),
      taxable_amount: Number(m.taxable_amount ?? 0),
      tax_amount: Number(m.tax_amount ?? 0),
      is_recoverable: m.is_recoverable !== false,
      is_zero_rated: flag?.zr ?? false,
      is_exempt: flag?.ex ?? false,
    };
  });
}

export function summarizeTaxMovements(
  movements: TaxMovementRow[],
  category: TaxReportCategory = 'all',
  revenueTotal = 0,
): PeriodTaxSummary {
  const filtered = movements.filter((m) => movementMatchesCategory(m, category));
  const rows = movementsToPeriodRows(filtered);

  let taxCollected = 0;
  let itcClaimed = 0;
  let taxableSales = 0;
  let totalPurchases = 0;

  const codeMap = new Map<string, TaxCodePeriodRow>();
  const accountMap = new Map<string, TaxAccountPeriodRow>();

  for (const m of filtered) {
    const amount = Number(m.tax_amount ?? 0);
    const taxable = Number(m.taxable_amount ?? 0);
    const side: TaxAccountSide = m.side === 'paid' ? 'paid' : 'collected';
    const code = m.code || m.account_code || 'Unclassified';

    if (!codeMap.has(code)) {
      codeMap.set(code, {
        code,
        name: m.name || code,
        rate: Number(m.rate ?? 0),
        taxableAmount: 0,
        taxCollected: 0,
        itcClaimed: 0,
        taxDue: 0,
      });
    }
    const codeRow = codeMap.get(code)!;

    const accountKey = `${m.account_code ?? ''}|${m.account_name ?? code}`;
    if (!accountMap.has(accountKey)) {
      accountMap.set(accountKey, {
        accountCode: m.account_code || '',
        accountName: m.account_name || code,
        side,
        periodAmount: 0,
      });
    }
    const accountRow = accountMap.get(accountKey)!;

    if (side === 'collected') {
      taxCollected += amount;
      taxableSales += taxable;
      codeRow.taxCollected += amount;
      codeRow.taxableAmount += taxable;
      accountRow.periodAmount += amount;
    } else {
      if (m.is_recoverable !== false) itcClaimed += amount;
      totalPurchases += taxable;
      codeRow.itcClaimed += amount;
      accountRow.periodAmount += amount;
    }
  }

  const byTaxCode = Array.from(codeMap.values())
    .map((row) => ({
      ...row,
      taxableAmount: round2(row.taxableAmount),
      taxCollected: round2(row.taxCollected),
      itcClaimed: round2(row.itcClaimed),
      taxDue: round2(row.taxCollected - row.itcClaimed),
    }))
    .sort((a, b) => a.code.localeCompare(b.code));

  const byAccount = Array.from(accountMap.values())
    .map((row) => ({ ...row, periodAmount: round2(row.periodAmount) }))
    .sort((a, b) => a.accountCode.localeCompare(b.accountCode) || a.accountName.localeCompare(b.accountName));

  taxCollected = round2(taxCollected);
  itcClaimed = round2(itcClaimed);
  taxableSales = round2(taxableSales);
  const netPayable = round2(taxCollected - itcClaimed);

  const totals: PeriodTotals = {
    rows,
    totalSales: round2(revenueTotal || taxableSales),
    totalPurchases: round2(totalPurchases),
  };

  return {
    taxableSales,
    taxCollected,
    itcClaimed,
    netPayable,
    byTaxCode,
    byAccount,
    rows,
    totals,
  };
}

export function buildPeriodFilingForm(
  summary: PeriodTaxSummary,
  meta: FilingMeta,
): FilingFormResult {
  return buildFilingForm(summary.totals, meta);
}

/**
 * Fallback when the GL RPC is unavailable. Uses period journal lines only —
 * never lifetime account balances. Remittances are not excluded here.
 */
export function summarizeJournalTaxLines(
  lines: JournalTaxLine[],
  category: TaxReportCategory = 'all',
  rateByCode: Record<string, number> = {},
): Pick<PeriodTaxSummary, 'taxCollected' | 'itcClaimed' | 'netPayable' | 'byAccount' | 'byTaxCode' | 'taxableSales' | 'rows'> {
  let taxCollected = 0;
  let itcClaimed = 0;
  let taxableSales = 0;
  const accountMap = new Map<string, TaxAccountPeriodRow>();
  const codeMap = new Map<string, TaxCodePeriodRow>();
  const rows: PeriodTaxRow[] = [];

  for (const line of lines) {
    const hay = `${line.account_name} ${line.tax_code ?? ''}`;
    if (category === 'gst' && isProvincialTaxHaystack(hay)) continue;
    if (category === 'pst' && !isProvincialTaxHaystack(hay)) continue;

    const side = classifyTaxAccountName(line.account_name);
    if (!side) continue;
    const amount =
      side === 'collected'
        ? Number(line.credit || 0) - Number(line.debit || 0)
        : Number(line.debit || 0) - Number(line.credit || 0);
    const code = line.tax_code || line.account_code || line.account_name || 'Unclassified';
    const rate = Number(rateByCode[line.tax_code ?? ''] || rateByCode[code] || 0);
    const taxable = rate > 0 ? round2(amount / (rate / 100)) : 0;

    if (side === 'collected') {
      taxCollected += amount;
      taxableSales += taxable;
    } else {
      itcClaimed += amount;
    }

    const accountKey = `${line.account_code ?? ''}|${line.account_name}`;
    if (!accountMap.has(accountKey)) {
      accountMap.set(accountKey, {
        accountCode: line.account_code || '',
        accountName: line.account_name,
        side,
        periodAmount: 0,
      });
    }
    accountMap.get(accountKey)!.periodAmount += amount;

    if (!codeMap.has(code)) {
      codeMap.set(code, {
        code,
        name: code,
        rate,
        taxableAmount: 0,
        taxCollected: 0,
        itcClaimed: 0,
        taxDue: 0,
      });
    }
    const codeRow = codeMap.get(code)!;
    if (side === 'collected') {
      codeRow.taxCollected += amount;
      codeRow.taxableAmount += taxable;
    } else {
      codeRow.itcClaimed += amount;
    }

    rows.push({
      source: side === 'collected' ? 'invoice' : 'bill',
      tax_type: normalizeMovementTaxType({
        code,
        tax_type: null,
        authority_name: null,
        account_name: line.account_name,
        side,
        rate,
        tax_amount: amount,
        taxable_amount: taxable,
      }),
      tax_code: code,
      authority: null,
      jurisdiction_code: null,
      rate,
      taxable_amount: taxable,
      tax_amount: amount,
      is_recoverable: true,
    });
  }

  taxCollected = round2(taxCollected);
  itcClaimed = round2(itcClaimed);
  taxableSales = round2(taxableSales);
  return {
    taxCollected,
    itcClaimed,
    netPayable: round2(taxCollected - itcClaimed),
    taxableSales,
    rows,
    byAccount: Array.from(accountMap.values()).map((row) => ({
      ...row,
      periodAmount: round2(row.periodAmount),
    })),
    byTaxCode: Array.from(codeMap.values())
      .map((row) => ({
        ...row,
        taxableAmount: round2(row.taxableAmount),
        taxCollected: round2(row.taxCollected),
        itcClaimed: round2(row.itcClaimed),
        taxDue: round2(row.taxCollected - row.itcClaimed),
      }))
      .sort((a, b) => a.code.localeCompare(b.code)),
  };
}

export function toISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseISODate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

export function resolveTaxDateRange(
  preset: TaxDatePreset,
  now = new Date(),
  customStart?: Date | string | null,
  customEnd?: Date | string | null,
): { start: Date; end: Date } {
  const toDate = (value: Date | string) => (value instanceof Date ? value : parseISODate(value));

  if (preset === 'custom') {
    const start = customStart ? toDate(customStart) : new Date(now.getFullYear(), now.getMonth(), 1);
    const end = customEnd ? toDate(customEnd) : now;
    return start <= end ? { start, end } : { start: end, end: start };
  }

  const year = now.getFullYear();
  const month = now.getMonth();
  const quarterStartMonth = Math.floor(month / 3) * 3;

  switch (preset) {
    case 'today':
      return { start: new Date(year, month, now.getDate()), end: new Date(year, month, now.getDate()) };
    case 'this_week': {
      const start = new Date(year, month, now.getDate() - now.getDay());
      const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
      return { start, end };
    }
    case 'this_month':
      return { start: new Date(year, month, 1), end: new Date(year, month + 1, 0) };
    case 'last_month':
      return { start: new Date(year, month - 1, 1), end: new Date(year, month, 0) };
    case 'this_quarter':
      return { start: new Date(year, quarterStartMonth, 1), end: new Date(year, quarterStartMonth + 3, 0) };
    case 'last_quarter':
      return { start: new Date(year, quarterStartMonth - 3, 1), end: new Date(year, quarterStartMonth, 0) };
    case 'this_year':
      return { start: new Date(year, 0, 1), end: new Date(year, 11, 31) };
    case 'last_year':
      return { start: new Date(year - 1, 0, 1), end: new Date(year - 1, 11, 31) };
    default:
      return { start: new Date(year, quarterStartMonth, 1), end: new Date(year, quarterStartMonth + 3, 0) };
  }
}

export type TaxCompareType = 'none' | 'previous_period' | 'previous_year';

export const MIN_COMPARE_PERIODS = 1;
export const MAX_COMPARE_PERIODS = 12;

/** Keep only digits while typing so the field does not jump to the max (e.g. 5). */
export function sanitizeComparePeriodCountInput(value: string): string {
  return value.replace(/\D/g, '').slice(0, 2);
}

export function commitComparePeriodCount(
  value: string | number,
  max = MAX_COMPARE_PERIODS,
): number {
  const num = typeof value === 'number' ? value : parseInt(value, 10);
  if (Number.isNaN(num) || num < MIN_COMPARE_PERIODS) return MIN_COMPARE_PERIODS;
  return Math.min(max, Math.floor(num));
}

export function stepComparePeriodCount(
  current: string | number,
  delta: number,
  max = MAX_COMPARE_PERIODS,
): number {
  return commitComparePeriodCount(commitComparePeriodCount(current, max) + delta, max);
}

export interface TaxComparisonRange {
  start: Date;
  end: Date;
  label: string;
}

export function resolveComparisonRanges(
  compareType: TaxCompareType,
  count: number,
  current: { start: Date; end: Date },
  preset: TaxDatePreset,
  latestFirst = true,
): TaxComparisonRange[] {
  const n = commitComparePeriodCount(count);
  if (compareType === 'none' || n < 1) return [];

  const ranges: TaxComparisonRange[] = [];
  const startMonth = current.start.getMonth();
  const startYear = current.start.getFullYear();
  const quarterStartMonth = Math.floor(startMonth / 3) * 3;

  for (let i = 1; i <= n; i += 1) {
    let start: Date;
    let end: Date;
    let label: string;

    if (compareType === 'previous_year') {
      start = new Date(current.start.getFullYear() - i, current.start.getMonth(), current.start.getDate());
      end = new Date(current.end.getFullYear() - i, current.end.getMonth(), current.end.getDate());
      label = `${toISODate(start) === toISODate(end) ? toISODate(start) : `${start.toLocaleString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}`;
    } else {
      switch (preset) {
        case 'today': {
          start = new Date(startYear, startMonth, current.start.getDate() - i);
          end = new Date(start);
          label = start.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
          break;
        }
        case 'this_week': {
          start = new Date(startYear, startMonth, current.start.getDate() - i * 7);
          end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
          label = `${start.toLocaleString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
          break;
        }
        case 'this_month':
        case 'last_month': {
          start = new Date(startYear, startMonth - i, 1);
          end = new Date(startYear, startMonth - i + 1, 0);
          label = start.toLocaleString('en-US', { month: 'short', year: 'numeric' });
          break;
        }
        case 'this_quarter':
        case 'last_quarter': {
          start = new Date(startYear, quarterStartMonth - 3 * i, 1);
          end = new Date(start.getFullYear(), start.getMonth() + 3, 0);
          label = `Q${Math.ceil((start.getMonth() + 1) / 3)} ${start.getFullYear()}`;
          break;
        }
        default: {
          start = new Date(startYear - i, 0, 1);
          end = new Date(startYear - i, 11, 31);
          label = String(start.getFullYear());
        }
      }
    }

    ranges.push({ start, end, label });
  }

  return latestFirst ? ranges : [...ranges].reverse();
}

export function inferTaxTransactionType(description?: string, reference?: string): string {
  const hay = `${description ?? ''} ${reference ?? ''}`.toLowerCase();
  if (hay.includes('invoice') || /\binv[-_ ]?\d/i.test(hay)) return 'Invoice';
  if (hay.includes('bill') || /\bbill[-_ ]?\d/i.test(hay)) return 'Bill';
  if (hay.includes('expense')) return 'Expense';
  if (hay.includes('credit note') || hay.includes('refund')) return 'Credit note';
  return 'Journal';
}

export function buildTaxDetailRows(lines: JournalTaxLine[], rateByCode: Record<string, number> = {}): TaxDetailRow[] {
  const rows: TaxDetailRow[] = [];
  for (const line of lines) {
    const side = classifyTaxAccountName(line.account_name);
    if (!side) continue;
    const taxAmount = round2(
      side === 'collected'
        ? Number(line.credit || 0) - Number(line.debit || 0)
        : Number(line.debit || 0) - Number(line.credit || 0),
    );
    const rate = rateByCode[line.tax_code ?? ''] || 0;
    const taxableAmount = rate > 0 ? round2(taxAmount / (rate / 100)) : 0;
    rows.push({
      date: line.entry_date || '',
      type: inferTaxTransactionType(line.description, line.reference),
      number: line.reference || '',
      description: line.line_description || line.description || '',
      accountCode: line.account_code || '',
      accountName: line.account_name,
      taxCode: line.tax_code || '',
      side,
      taxAmount,
      taxableAmount,
    });
  }
  return rows.sort((a, b) => a.date.localeCompare(b.date) || a.number.localeCompare(b.number));
}

export function groupTaxDetailByCode(rows: TaxDetailRow[]): TaxDetailGroup[] {
  const map = new Map<string, TaxDetailGroup>();
  for (const row of rows) {
    const taxCode = row.taxCode || row.accountName || 'Unclassified';
    if (!map.has(taxCode)) {
      map.set(taxCode, { taxCode, rows: [], taxableAmount: 0, taxAmount: 0 });
    }
    const group = map.get(taxCode)!;
    group.rows.push(row);
    group.taxableAmount = round2(group.taxableAmount + row.taxableAmount);
    group.taxAmount = round2(group.taxAmount + row.taxAmount);
  }
  return Array.from(map.values()).sort((a, b) => a.taxCode.localeCompare(b.taxCode));
}

/**
 * Prefer date-filtered journal activity so changing the range always changes
 * the totals — even when the selected period has zero postings.
 */
export function mergePeriodSummary(
  journal: Pick<PeriodTaxSummary, 'taxCollected' | 'itcClaimed' | 'netPayable' | 'byAccount' | 'byTaxCode' | 'taxableSales' | 'rows'>,
  rpc: PeriodTaxSummary,
  preferJournal: boolean,
): PeriodTaxSummary {
  if (!preferJournal) return rpc;
  const rows = journal.rows.length > 0 ? journal.rows : rpc.rows;
  const taxableSales = journal.taxableSales || rpc.taxableSales || rpc.totals.totalSales;
  return {
    taxCollected: journal.taxCollected,
    itcClaimed: journal.itcClaimed,
    netPayable: journal.netPayable,
    taxableSales,
    byAccount: journal.byAccount,
    byTaxCode: journal.byTaxCode.length > 0 ? journal.byTaxCode : rpc.byTaxCode,
    rows,
    totals: {
      rows,
      totalSales: rpc.totals.totalSales || taxableSales,
      totalPurchases: rpc.totals.totalPurchases,
    },
  };
}
