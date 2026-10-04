import { describe, expect, it } from 'vitest';
import { calculateTax } from '@/components/banking/TaxCodeSelect';
import {
  creditCardRefundJournal,
  expenseRefundJournal,
  isExpenseRefund,
  planBankTaxLines,
} from './expenseRefundPosting';

const chart = [
  { id: 'taxes-payable', name: 'Taxes Payable', is_header: true, account_type: 'liability', posting_allowed: false },
  { id: 'gst-pay', name: 'GST/HST Payable', parent_id: 'taxes-payable', account_type: 'liability' },
  { id: 'pst-pay', name: 'PST Payable', parent_id: 'taxes-payable', account_type: 'liability' },
  { id: 'gst-itc', name: 'GST/HST Input Tax Credits (ITC)', account_type: 'asset' },
  { id: 'pst-paid', name: 'PST Paid (Non-Recoverable)', account_type: 'expense' },
  { id: 'office', name: 'Office', code: '6-03-105', account_type: 'expense' },
  { id: 'sales', name: 'Sales', account_type: 'income' },
  { id: 'bank', name: 'Operating Bank', account_type: 'asset' },
];

const manitoba = {
  code: 'GST+PST-MB',
  name: 'Manitoba (12%)',
  rate: 12,
  jurisdiction: 'MB',
  tax_type: 'GST+PST',
  gl_collected_account_id: 'taxes-payable',
  gl_paid_account_id: null,
  component_taxes: [
    { code: 'GST', rate: 5, glCollectedAccountId: 'taxes-payable', glPaidAccountId: 'gst-itc' },
    { code: 'PST-MB', rate: 7, glCollectedAccountId: 'taxes-payable', glPaidAccountId: 'pst-paid' },
  ],
};

describe('expense refund deposits', () => {
  it('reverses an office expense and the Manitoba sales tax without using the Taxes Payable header', () => {
    const tax = calculateTax(1.39, manitoba as never, true, 'deposit');
    expect(tax.subtotal).toBe(1.24);
    expect(tax.taxBreakdown.map((line) => [line.code, line.amount])).toEqual([
      ['GST', 0.06],
      ['PST', 0.09],
    ]);
    expect(tax.taxBreakdown.every((line) => line.glAccountId === 'taxes-payable')).toBe(true);

    const planned = planBankTaxLines({
      transactionType: 'deposit',
      offsetAccounts: [{ account_type: 'expense' }],
      taxBreakdown: tax.taxBreakdown,
      taxCode: manitoba,
      accounts: chart,
    });

    expect(planned.expenseRefund).toBe(true);
    expect(planned.error).toBeNull();
    expect(planned.lines.map((line) => [line.code, line.glAccountId, line.memoKind])).toEqual([
      ['GST', 'gst-itc', 'reversed'],
      ['PST', 'pst-paid', 'reversed'],
    ]);

    const journal = expenseRefundJournal({
      bankAccountId: 'bank',
      offsetLines: [{ accountId: 'office', amount: tax.subtotal, memo: 'Office' }],
      taxLines: planned.lines,
      description: 'correction',
      payee: 'Opos Canva',
    });
    const cents = (lines: { debit: number; credit: number }[], field: 'debit' | 'credit') =>
      Math.round(lines.reduce((sum, line) => sum + line[field], 0) * 100);
    expect(cents(journal, 'debit')).toBe(139);
    expect(cents(journal, 'credit')).toBe(139);
    expect(journal.map((line) => [line.account_id, line.debit, line.credit])).toEqual([
      ['bank', 1.39, 0],
      ['office', 0, 1.24],
      ['gst-itc', 0, 0.06],
      ['pst-paid', 0, 0.09],
    ]);
    expect(journal.some((line) => line.account_id === 'taxes-payable')).toBe(false);
    expect(journal.some((line) => line.memo.includes('reversed'))).toBe(true);
  });

  it('keeps a sales deposit on postable GST and PST payable accounts', () => {
    const planned = planBankTaxLines({
      transactionType: 'deposit',
      offsetAccounts: [{ account_type: 'income' }],
      taxBreakdown: [
        { code: 'GST', rate: 5, amount: 0.06, glAccountId: 'taxes-payable' },
        { code: 'PST', rate: 7, amount: 0.09, glAccountId: 'taxes-payable' },
      ],
      taxCode: manitoba,
      accounts: chart,
    });
    expect(planned.expenseRefund).toBe(false);
    expect(planned.error).toBeNull();
    expect(planned.lines.map((line) => line.glAccountId)).toEqual(['gst-pay', 'pst-pay']);
  });

  it('refuses to post when the only tax account is the Taxes Payable header', () => {
    const planned = planBankTaxLines({
      transactionType: 'deposit',
      offsetAccounts: [{ account_type: 'expense' }],
      taxBreakdown: [{ code: 'GST', rate: 5, amount: 0.06, glAccountId: 'taxes-payable' }],
      accounts: [
        { id: 'taxes-payable', name: 'Taxes Payable', is_header: true, posting_allowed: false },
      ],
    });
    expect(planned.error).toMatch(/Cannot post GST to header account "Taxes Payable"/);
    expect(planned.lines.every((line) => line.glAccountId !== 'taxes-payable')).toBe(true);
  });

  it('does not treat a mixed or income offset as an expense refund', () => {
    expect(isExpenseRefund([{ account_type: 'expense' }, { account_type: 'expense' }])).toBe(true);
    expect(isExpenseRefund([{ account_type: 'income' }])).toBe(false);
    expect(isExpenseRefund([{ account_type: 'expense' }, { account_type: 'income' }])).toBe(false);
    expect(isExpenseRefund([])).toBe(false);
  });

  it('reverses sales tax on a credit-card refund of an expense', () => {
    const planned = planBankTaxLines({
      transactionType: 'deposit',
      offsetAccounts: [{ account_type: 'expense' }],
      taxBreakdown: [
        { code: 'GST', rate: 5, amount: 0.06, glAccountId: 'taxes-payable' },
        { code: 'PST', rate: 7, amount: 0.09, glAccountId: 'taxes-payable' },
      ],
      taxCode: manitoba,
      accounts: chart,
    });
    const journal = creditCardRefundJournal({
      liabilityAccountId: 'card',
      offsetAccountId: 'office',
      grossAmount: 1.39,
      taxLines: planned.lines,
      description: 'correction',
    });
    expect(journal.map((line) => [line.account_id, line.debit, line.credit])).toEqual([
      ['card', 1.39, 0],
      ['office', 0, 1.24],
      ['gst-itc', 0, 0.06],
      ['pst-paid', 0, 0.09],
    ]);
  });
});
