import { describe, it, expect } from 'vitest';
import { buildGstHstReturn } from '../filings/canadaGstHst';
import {
  classifyTaxAccountName,
  summarizeJournalTaxLines,
  summarizeTaxMovements,
  resolveTaxDateRange,
  toISODate,
  sanitizeComparePeriodCountInput,
  commitComparePeriodCount,
  stepComparePeriodCount,
  resolveComparisonRanges,
  buildTaxDetailRows,
  mergePeriodSummary,
  groupTaxDetailByCode,
  type TaxMovementRow,
} from '../taxPeriodReport';

const hstCollected = (amount: number, taxable: number): TaxMovementRow => ({
  code: 'HST-ON',
  name: 'HST - Ontario',
  rate: 13,
  tax_type: 'HST',
  authority_name: 'CRA',
  is_recoverable: true,
  side: 'collected',
  account_code: '2-01-102-0001',
  account_name: 'GST/HST Collected',
  tax_amount: amount,
  taxable_amount: taxable,
});

const hstPaid = (amount: number, taxable: number): TaxMovementRow => ({
  code: 'HST-ON',
  name: 'HST - Ontario',
  rate: 13,
  tax_type: 'HST',
  authority_name: 'CRA',
  is_recoverable: true,
  side: 'paid',
  account_code: '2-01-102-0002',
  account_name: 'GST/HST Paid (Input Tax Credit)',
  tax_amount: amount,
  taxable_amount: taxable,
});

describe('classifyTaxAccountName', () => {
  it('classifies collected and payable GST/HST accounts as collected', () => {
    expect(classifyTaxAccountName('GST/HST Collected')).toBe('collected');
    expect(classifyTaxAccountName('GST/HST Payable')).toBe('collected');
  });

  it('classifies ITC / paid accounts as paid, not collected', () => {
    expect(classifyTaxAccountName('GST/HST Paid (Input Tax Credit)')).toBe('paid');
    expect(classifyTaxAccountName('GST/HST Input Tax Credit')).toBe('paid');
  });

  it('does not treat a remittance bank account as a tax account', () => {
    expect(classifyTaxAccountName('Operating Bank')).toBeNull();
  });
});

describe('summarizeTaxMovements', () => {
  it('uses period activity, not a lifetime GL balance', () => {
    const summary = summarizeTaxMovements(
      [hstCollected(465.71, 3582.38), hstPaid(71.45, 549.62)],
      'gst',
      3582.38,
    );

    expect(summary.taxCollected).toBe(465.71);
    expect(summary.itcClaimed).toBe(71.45);
    expect(summary.netPayable).toBe(394.26);
    expect(summary.taxableSales).toBe(3582.38);
    expect(summary.taxCollected).not.toBe(46570.68);
    expect(summary.byTaxCode).toHaveLength(1);
    expect(summary.byTaxCode[0].taxDue).toBe(394.26);
    expect(summary.byAccount.map((a) => a.accountCode).sort()).toEqual([
      '2-01-102-0001',
      '2-01-102-0002',
    ]);
  });

  it('keeps PST out of the CRA GST/HST report', () => {
    const summary = summarizeTaxMovements(
      [
        hstCollected(130, 1000),
        {
          code: 'PST-BC',
          name: 'PST - British Columbia',
          rate: 7,
          tax_type: 'PST',
          side: 'collected',
          account_name: 'PST Payable',
          tax_amount: 70,
          taxable_amount: 1000,
        },
      ],
      'gst',
    );
    expect(summary.taxCollected).toBe(130);
  });
});

describe('summarizeJournalTaxLines', () => {
  it('computes collected as credits minus debits for the period', () => {
    const summary = summarizeJournalTaxLines(
      [
        { account_name: 'GST/HST Collected', debit: 0, credit: 1300 },
        { account_name: 'GST/HST Collected', debit: 200, credit: 0 },
        { account_name: 'GST/HST Paid (Input Tax Credit)', debit: 150, credit: 0 },
      ],
      'gst',
    );
    expect(summary.taxCollected).toBe(1100);
    expect(summary.itcClaimed).toBe(150);
    expect(summary.netPayable).toBe(950);
  });

  it('does not use Math.abs on a debit-balance liability', () => {
    const summary = summarizeJournalTaxLines(
      [{ account_name: 'GST/HST Collected', debit: 50, credit: 0 }],
      'gst',
    );
    expect(summary.taxCollected).toBe(-50);
    expect(summary.netPayable).toBe(-50);
  });
});

describe('GST34 from period movements', () => {
  it('maps collected and ITCs onto CRA lines 103/106/109', () => {
    const summary = summarizeTaxMovements(
      [hstCollected(1300, 10000), hstPaid(200, 1538.46)],
      'gst',
      10000,
    );
    const form = buildGstHstReturn(summary.totals, {
      authority: 'CRA',
      periodStart: '2026-07-01',
      periodEnd: '2026-09-30',
    });
    const line = (code: string) => form.lines.find((l) => l.code === code)?.amount;
    expect(line('101')).toBe(10000);
    expect(line('103')).toBe(1300);
    expect(line('106')).toBe(200);
    expect(line('109')).toBe(1100);
    expect(form.netPayable).toBe(1100);
  });
});

describe('resolveTaxDateRange', () => {
  const now = new Date(2026, 8, 18);

  it('switches this quarter and last quarter to different bounds', () => {
    const current = resolveTaxDateRange('this_quarter', now);
    const previous = resolveTaxDateRange('last_quarter', now);
    expect(toISODate(current.start)).toBe('2026-07-01');
    expect(toISODate(current.end)).toBe('2026-09-30');
    expect(toISODate(previous.start)).toBe('2026-04-01');
    expect(toISODate(previous.end)).toBe('2026-06-30');
  });

  it('uses explicit From/To when the preset is custom', () => {
    const range = resolveTaxDateRange('custom', now, '2026-01-01', '2026-01-31');
    expect(toISODate(range.start)).toBe('2026-01-01');
    expect(toISODate(range.end)).toBe('2026-01-31');
  });
});

describe('compare period count selector', () => {
  it('lets the user type 12 without clamping to 5 mid-keystroke', () => {
    expect(sanitizeComparePeriodCountInput('1')).toBe('1');
    expect(sanitizeComparePeriodCountInput('12')).toBe('12');
    expect(sanitizeComparePeriodCountInput('12a')).toBe('12');
    expect(sanitizeComparePeriodCountInput('')).toBe('');
  });

  it('commits empty or invalid values to 1 and caps at 12, not 5', () => {
    expect(commitComparePeriodCount('')).toBe(1);
    expect(commitComparePeriodCount('5')).toBe(5);
    expect(commitComparePeriodCount('12')).toBe(12);
    expect(commitComparePeriodCount('50')).toBe(12);
    expect(stepComparePeriodCount('5', 1)).toBe(6);
    expect(stepComparePeriodCount('1', -1)).toBe(1);
  });
});

describe('resolveComparisonRanges', () => {
  it('builds N previous quarters from the current quarter without repeating the current range', () => {
    const current = resolveTaxDateRange('this_quarter', new Date(2026, 8, 18));
    const ranges = resolveComparisonRanges('previous_period', 2, current, 'this_quarter', true);
    expect(ranges).toHaveLength(2);
    expect(toISODate(ranges[0].start)).toBe('2026-04-01');
    expect(toISODate(ranges[0].end)).toBe('2026-06-30');
    expect(ranges[0].label).toBe('Q2 2026');
    expect(toISODate(ranges[1].start)).toBe('2026-01-01');
    expect(toISODate(ranges[1].end)).toBe('2026-03-31');
    expect(ranges[1].label).toBe('Q1 2026');
  });
});

describe('period switching changes amounts', () => {
  it('does not reuse Q3 totals when summarizing Q2 journal lines', () => {
    const q2 = summarizeJournalTaxLines(
      [{ account_name: 'GST/HST Collected', debit: 0, credit: 1000, entry_date: '2026-05-15' }],
      'gst',
    );
    const q3 = summarizeJournalTaxLines(
      [{ account_name: 'GST/HST Collected', debit: 0, credit: 250, entry_date: '2026-08-15' }],
      'gst',
    );
    expect(q2.taxCollected).toBe(1000);
    expect(q3.taxCollected).toBe(250);
    expect(q2.taxCollected).not.toBe(q3.taxCollected);
  });

  it('keeps journal period totals even if RPC still has a lifetime balance', () => {
    const journal = summarizeJournalTaxLines(
      [{ account_name: 'GST/HST Collected', debit: 0, credit: 250, tax_code: 'HST-ON' }],
      'gst',
      { 'HST-ON': 13 },
    );
    const rpc = summarizeTaxMovements([hstCollected(45134.93, 347191)], 'gst');
    const merged = mergePeriodSummary(journal, rpc, true);
    expect(merged.taxCollected).toBe(250);
    expect(merged.taxCollected).not.toBe(45134.93);
    expect(merged.byTaxCode[0].taxCollected).toBe(250);
  });

  it('shows zeros for an empty period instead of reusing RPC lifetime totals', () => {
    const journal = summarizeJournalTaxLines([], 'gst');
    const rpc = summarizeTaxMovements([hstCollected(45134.93, 347191)], 'gst');
    const merged = mergePeriodSummary(journal, rpc, true);
    expect(merged.taxCollected).toBe(0);
    expect(merged.itcClaimed).toBe(0);
    expect(merged.byAccount).toEqual([]);
  });
});

describe('buildTaxDetailRows', () => {
  it('builds a QuickBooks-style transaction row with tax amount for the period', () => {
    const [row] = buildTaxDetailRows(
      [{
        account_name: 'GST/HST Collected',
        account_code: '2-01-102-0001',
        debit: 0,
        credit: 130,
        tax_code: 'HST-ON',
        entry_date: '2026-05-02',
        description: 'Invoice INV-1044',
        reference: 'INV-1044',
      }],
      { 'HST-ON': 13 },
    );
    expect(row.type).toBe('Invoice');
    expect(row.number).toBe('INV-1044');
    expect(row.taxAmount).toBe(130);
    expect(row.taxableAmount).toBe(1000);
    expect(row.side).toBe('collected');
  });

  it('groups QuickBooks-style rows by tax code with period subtotals', () => {
    const rows = buildTaxDetailRows([
      {
        account_name: 'GST/HST Collected',
        debit: 0,
        credit: 130,
        tax_code: 'HST-ON',
        entry_date: '2026-04-10',
        reference: 'INV-1',
        description: 'Invoice INV-1',
      },
      {
        account_name: 'GST/HST Collected',
        debit: 0,
        credit: 65,
        tax_code: 'HST-ON',
        entry_date: '2026-05-10',
        reference: 'INV-2',
        description: 'Invoice INV-2',
      },
      {
        account_name: 'GST/HST Paid (Input Tax Credit)',
        debit: 26,
        credit: 0,
        tax_code: 'HST-ON',
        entry_date: '2026-05-12',
        reference: 'BILL-9',
        description: 'Bill BILL-9',
      },
    ], { 'HST-ON': 13 });
    const groups = groupTaxDetailByCode(rows);
    expect(groups).toHaveLength(1);
    expect(groups[0].taxCode).toBe('HST-ON');
    expect(groups[0].rows).toHaveLength(3);
    expect(groups[0].taxAmount).toBe(221);
  });
});
