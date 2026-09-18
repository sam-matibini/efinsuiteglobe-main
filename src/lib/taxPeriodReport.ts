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

export interface JournalTaxLine {
  account_name: string;
  account_code?: string;
  debit: number;
  credit: number;
  tax_code?: string;
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
): Pick<PeriodTaxSummary, 'taxCollected' | 'itcClaimed' | 'netPayable'> {
  let taxCollected = 0;
  let itcClaimed = 0;

  for (const line of lines) {
    const hay = `${line.account_name} ${line.tax_code ?? ''}`;
    if (category === 'gst' && isProvincialTaxHaystack(hay)) continue;
    if (category === 'pst' && !isProvincialTaxHaystack(hay)) continue;

    const side = classifyTaxAccountName(line.account_name);
    if (side === 'collected') taxCollected += Number(line.credit || 0) - Number(line.debit || 0);
    else if (side === 'paid') itcClaimed += Number(line.debit || 0) - Number(line.credit || 0);
  }

  taxCollected = round2(taxCollected);
  itcClaimed = round2(itcClaimed);
  return {
    taxCollected,
    itcClaimed,
    netPayable: round2(taxCollected - itcClaimed),
  };
}
