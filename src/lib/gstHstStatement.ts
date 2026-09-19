/**
 * QuickBooks-style GST/HST Summary and Detail statements.
 *
 * Summary columns: LINE DESCRIPTION / AMOUNT / EXCEPTION AMOUNT / TOTAL LINE AMOUNT / BALANCE
 * Detail: grouped by CRA line with a running tax-amount balance (includes 0% ZR rows).
 */
import type { GstHstPeriodSnapshot, GstHstSupportRow } from '@/lib/gstHstPeriodEngine';

export interface GstHstQbSummaryLine {
  code: string;
  description: string;
  amount: number | null;
  exceptionAmount: number | null;
  totalLineAmount: number | null;
  balance: number | null;
  emphasize?: boolean;
}

export interface GstHstQbDetailRow extends GstHstSupportRow {
  balance: number;
}

export interface GstHstQbDetailGroup {
  line: string;
  label: string;
  rows: GstHstQbDetailRow[];
  taxableAmount: number;
  taxAmount: number;
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

function dataLine(
  code: string,
  description: string,
  amount: number,
  exceptionAmount = 0,
): GstHstQbSummaryLine {
  return {
    code,
    description,
    amount,
    exceptionAmount,
    totalLineAmount: round2(amount + exceptionAmount),
    balance: null,
  };
}

function balanceLine(code: string, description: string, balance: number, emphasize = true): GstHstQbSummaryLine {
  return {
    code,
    description,
    amount: null,
    exceptionAmount: null,
    totalLineAmount: 0,
    balance,
    emphasize,
  };
}

export function buildGstHstQbSummary(snapshot: GstHstPeriodSnapshot): GstHstQbSummaryLine[] {
  const collectedGross = snapshot.gstHstCollectedGross ?? snapshot.gstHstCollected;
  const collectedException = snapshot.gstHstCollectedException ?? 0;
  const collectedTotal = round2(collectedGross + collectedException);
  const itcGross = snapshot.itcGross ?? snapshot.itc;
  const itcException = snapshot.itcException ?? 0;
  const itcTotal = round2(itcGross + itcException);
  const adjustmentsSales = 0;
  const adjustmentsPurchases = 0;
  const totalGst = round2(collectedTotal + adjustmentsSales);
  const totalItc = round2(itcTotal + adjustmentsPurchases);
  const netTax = round2(totalGst - totalItc);
  const instalments = 0;
  const rebates = 0;
  const otherCredits = round2(instalments + rebates);
  const afterCredits = round2(netTax - otherCredits);
  const realProperty = 0;
  const selfAssessed = 0;
  const otherDebits = round2(realProperty + selfAssessed);
  const finalBalance = round2(afterCredits + otherDebits);

  return [
    dataLine('101', 'Sales and other revenue', snapshot.line101),
    dataLine('103', 'GST/HST collected or collectible', collectedGross, collectedException),
    dataLine('104', 'Adjustments (Sales)', adjustmentsSales),
    balanceLine('105', 'Total GST/HST and adjustments for period', totalGst),
    dataLine('106', 'Input tax credits (ITCs)', itcGross, itcException),
    dataLine('107', 'Adjustments (Purchases)', adjustmentsPurchases),
    balanceLine('108', 'Total ITCs and adjustments', totalItc),
    balanceLine('109', 'Net Tax', netTax),
    dataLine('110', 'Instalments and other annual filer payments', instalments),
    dataLine('111', 'Rebates', rebates),
    balanceLine('112', 'Total other credits', otherCredits, false),
    balanceLine('113', 'Balance', afterCredits),
    dataLine('205', 'GST/HST due on acquisition of taxable real property', realProperty),
    dataLine('405', 'Other GST/HST to be self-assessed', selfAssessed),
    balanceLine('113B', 'Total other debits', otherDebits, false),
    balanceLine('113A', 'Balance', finalBalance),
    balanceLine('114', 'Transfer Amount (Liability -> Suspense)', finalBalance),
  ];
}

const DETAIL_GROUP_ORDER = ['103', '106', '91', '—'];

const DETAIL_GROUP_LABELS: Record<string, string> = {
  '103': 'GST/HST collected or collectible',
  '106': 'Input tax credits (ITCs)',
  '91': 'Exempt / other revenue',
  '—': 'Non-recoverable GST/HST',
};

export function qbDetailGroupKey(row: GstHstSupportRow): string {
  if (row.craLine === '90A / 103' || row.craLine === '90B' || row.craLine === '103') return '103';
  if (row.craLine === '106') return '106';
  if (row.craLine === '91') return '91';
  return row.craLine || '—';
}

export function buildGstHstQbDetail(rows: GstHstSupportRow[]): GstHstQbDetailGroup[] {
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date) || a.number.localeCompare(b.number));
  const map = new Map<string, GstHstSupportRow[]>();
  for (const row of sorted) {
    const key = qbDetailGroupKey(row);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(row);
  }
  const extra = Array.from(map.keys()).filter((key) => !DETAIL_GROUP_ORDER.includes(key)).sort();
  return [...DETAIL_GROUP_ORDER, ...extra]
    .filter((key) => map.has(key))
    .map((key) => {
      const groupRows = map.get(key)!;
      let running = 0;
      const withBalance: GstHstQbDetailRow[] = groupRows.map((row) => {
        running = round2(running + Number(row.taxAmount ?? 0));
        return { ...row, name: row.name ?? '', taxRate: Number(row.taxRate ?? 0), balance: running };
      });
      return {
        line: key,
        label: DETAIL_GROUP_LABELS[key] || key,
        rows: withBalance,
        taxableAmount: round2(groupRows.reduce((sum, row) => sum + row.taxableAmount, 0)),
        taxAmount: round2(groupRows.reduce((sum, row) => sum + row.taxAmount, 0)),
      };
    });
}

export function formatQbPeriodHeading(start: string, end: string): string {
  const toParts = (value: string) => {
    const [year, month, day] = value.split('-');
    return `${day}/${month}/${year}`;
  };
  return `${toParts(start)} - ${toParts(end)}`;
}

export function formatQbPeriodLong(start: string, end: string): string {
  const startDate = new Date(`${start}T00:00:00`);
  const endDate = new Date(`${end}T00:00:00`);
  const startText = startDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  const endText = endDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  return `${startText} - ${endText}`;
}
