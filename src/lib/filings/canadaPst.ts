/**
 * Canada Provincial Sales Tax (BC, SK, MB) return mapper.
 * PST is non-recoverable for most registrants — net = collected only.
 */
import { PeriodTotals, FilingFormResult, FilingFormLine, sumWhere } from './types';

export function buildPstReturn(
  totals: PeriodTotals,
  meta: { authority: string; periodStart: string; periodEnd: string; currency?: string; province?: string }
): FilingFormResult {
  const { rows, totalSales } = totals;
  const pstRows = rows.filter((r) => /^pst|rst$/i.test(r.tax_type));

  const taxableSales = sumWhere(pstRows, (r) => r.source === 'invoice', 'taxable_amount');
  const taxCollected = sumWhere(pstRows, (r) => r.source === 'invoice');
  const taxOnPurchases = sumWhere(pstRows, (r) => r.source === 'bill' || r.source === 'expense'); // self-assessed
  const commission = 0;
  const netPayable = Math.round((taxCollected + taxOnPurchases - commission) * 100) / 100;

  const lines: FilingFormLine[] = [
    { code: 'A', label: 'Total sales', amount: totalSales, category: 'sales' },
    { code: 'B', label: 'Taxable sales', amount: taxableSales, category: 'sales' },
    { code: 'C', label: 'PST collected on sales', amount: taxCollected, category: 'tax_collected' },
    { code: 'D', label: 'PST self-assessed on purchases', amount: taxOnPurchases, category: 'tax_collected' },
    { code: 'E', label: 'Commission', amount: commission, category: 'adjustment' },
    { code: 'F', label: 'Net PST payable', amount: netPayable, category: 'net', formula: 'C + D - E' },
  ];

  return {
    formCode: meta.province ? `PST-${meta.province}` : 'PST',
    formName: `Provincial Sales Tax Return${meta.province ? ` (${meta.province})` : ''}`,
    authority: meta.authority,
    periodStart: meta.periodStart,
    periodEnd: meta.periodEnd,
    currency: meta.currency ?? 'CAD',
    lines,
    netPayable,
  };
}
