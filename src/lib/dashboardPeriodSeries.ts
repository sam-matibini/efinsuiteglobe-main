import { toLocalISO } from '@/lib/dateRangePresets';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export interface DashboardPeriodPoint {
  month: string;
  revenue: number;
  expenses: number;
}

export interface DashboardPeriodLine {
  entryDate: string;
  accountCode: string;
  accountType?: string;
  debit: number;
  credit: number;
}

export function monthsOverlapping(start: Date, end: Date): { key: string; label: string }[] {
  const first = new Date(start.getFullYear(), start.getMonth(), 1);
  const last = new Date(end.getFullYear(), end.getMonth(), 1);
  if (last < first) return [];
  const spansYears = first.getFullYear() !== last.getFullYear();
  const months: { key: string; label: string }[] = [];
  const cursor = new Date(first);
  while (cursor <= last && months.length < 36) {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    months.push({
      key: `${year}-${String(month + 1).padStart(2, '0')}`,
      label: spansYears ? `${MONTHS[month]} ${String(year).slice(2)}` : MONTHS[month],
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return months;
}

/** Revenue and expense activity for the months inside the selected dashboard range. */
export function revenueExpenseByMonth(
  lines: DashboardPeriodLine[],
  start: Date,
  end: Date,
): DashboardPeriodPoint[] {
  const months = monthsOverlapping(start, end);
  const buckets = new Map(months.map((month) => [month.key, { month: month.label, revenue: 0, expenses: 0 }]));
  const startIso = toLocalISO(start);
  const endIso = toLocalISO(end);

  for (const line of lines) {
    const day = String(line.entryDate).substring(0, 10);
    if (day < startIso || day > endIso) continue;
    const bucket = buckets.get(day.substring(0, 7));
    if (!bucket) continue;
    const code = line.accountCode || '';
    const type = line.accountType || '';
    const debit = Number(line.debit) || 0;
    const credit = Number(line.credit) || 0;
    const isIncome = type === 'income' || (!type && (code.startsWith('4') || code.startsWith('7')));
    const isExpense = type === 'expense' || type === 'cogs' || (!type && /^[5689]/.test(code));
    if (isIncome) bucket.revenue += credit - debit;
    else if (isExpense) bucket.expenses += debit - credit;
  }

  return months.map((month) => {
    const bucket = buckets.get(month.key)!;
    return {
      month: bucket.month,
      revenue: Math.round(bucket.revenue * 100) / 100,
      expenses: Math.round(bucket.expenses * 100) / 100,
    };
  });
}
