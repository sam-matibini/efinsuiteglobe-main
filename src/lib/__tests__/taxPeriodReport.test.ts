import { describe, it, expect } from 'vitest';
import { buildGstHstReturn } from '../filings/canadaGstHst';
import {
  classifyTaxAccountName,
  summarizeJournalTaxLines,
  summarizeTaxMovements,
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
