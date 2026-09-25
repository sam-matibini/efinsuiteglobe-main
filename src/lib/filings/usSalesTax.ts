/**
 * Generic US Sales/Use Tax return mapper.
 * Most US states share a common structure: gross sales, deductions, taxable sales, tax due.
 */
import { PeriodTotals, FilingFormResult, FilingFormLine, sumWhere } from './types';

export function buildUsSalesTaxReturn(
  totals: PeriodTotals,
  meta: { authority: string; periodStart: string; periodEnd: string; currency?: string; state?: string }
): FilingFormResult {
  const { rows, totalSales } = totals;
  const salesTaxRows = rows.filter((r) => /^(sales|use|salestax)$/i.test(r.tax_type));

  const taxableSales = sumWhere(salesTaxRows, (r) => r.source === 'invoice', 'taxable_amount');
  const exemptSales = Math.max(0, Math.round((totalSales - taxableSales) * 100) / 100);
  const taxDue = sumWhere(salesTaxRows, (r) => r.source === 'invoice');
  const useTax = sumWhere(salesTaxRows, (r) => r.source === 'bill' || r.source === 'expense');
  const discount = 0;
  const netPayable = Math.round((taxDue + useTax - discount) * 100) / 100;

  const lines: FilingFormLine[] = [
    { code: '1', label: 'Gross sales', amount: totalSales, category: 'sales' },
    { code: '2', label: 'Exempt / non-taxable sales', amount: exemptSales, category: 'adjustment' },
    { code: '3', label: 'Taxable sales', amount: taxableSales, category: 'sales', formula: '1 - 2' },
    { code: '4', label: 'Sales tax due', amount: taxDue, category: 'tax_collected' },
    { code: '5', label: 'Use tax due', amount: useTax, category: 'tax_collected' },
    { code: '6', label: 'Vendor discount', amount: discount, category: 'adjustment' },
    { code: '7', label: 'Net tax payable', amount: netPayable, category: 'net', formula: '4 + 5 - 6' },
  ];

  return {
    formCode: meta.state ? `US-${meta.state}` : 'US-SALES',
    formName: `US Sales & Use Tax Return${meta.state ? ` (${meta.state})` : ''}`,
    authority: meta.authority,
    periodStart: meta.periodStart,
    periodEnd: meta.periodEnd,
    currency: meta.currency ?? 'USD',
    lines,
    netPayable,
  };
}
