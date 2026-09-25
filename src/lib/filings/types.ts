/**
 * Shared types for tax filing form mappers.
 * Each filing function takes aggregated period data and returns a structured
 * form (line numbers + amounts) ready for preview, export, or e-file.
 */

export interface PeriodTaxRow {
  source: 'invoice' | 'bill' | 'expense';
  tax_type: string;
  tax_code: string | null;
  authority: string | null;
  jurisdiction_code: string | null;
  rate: number;
  taxable_amount: number;
  tax_amount: number;
  is_recoverable: boolean;
  is_zero_rated?: boolean;
  is_exempt?: boolean;
}

export interface PeriodTotals {
  totalSales: number;          // sum of invoice subtotals
  totalPurchases: number;      // sum of bill + expense subtotals
  rows: PeriodTaxRow[];
}

export interface FilingFormLine {
  code: string;        // e.g. "101", "Box 1"
  label: string;
  amount: number;
  category: 'sales' | 'tax_collected' | 'itc' | 'net' | 'instalment' | 'adjustment' | 'memo';
  formula?: string;
}

export interface FilingFormResult {
  formCode: string;        // e.g. "GST34", "PST", "VAT100"
  formName: string;
  authority: string;
  periodStart: string;
  periodEnd: string;
  currency: string;
  lines: FilingFormLine[];
  netPayable: number;      // > 0 owe, < 0 refund
}

export const sumWhere = (
  rows: PeriodTaxRow[],
  predicate: (r: PeriodTaxRow) => boolean,
  field: 'tax_amount' | 'taxable_amount' = 'tax_amount'
): number => {
  return Math.round(rows.filter(predicate).reduce((s, r) => s + Number(r[field] ?? 0), 0) * 100) / 100;
};
