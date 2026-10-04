/**
 * E2E-only page for an expense-refund deposit.
 * Registered at /__e2e__/expense-refund when served with VITE_E2E=1.
 */
import { useMemo, useState } from 'react';
import { calculateTax } from '@/components/banking/TaxCodeSelect';
import { expenseRefundJournal, planBankTaxLines } from '@/lib/expenseRefundPosting';

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

const money = (value: number) => value.toLocaleString('en-CA', { style: 'currency', currency: 'CAD' });

export default function E2EExpenseRefundHarness() {
  const [accountId, setAccountId] = useState('office');
  const account = chart.find((row) => row.id === accountId) ?? chart[5];
  const tax = useMemo(
    () => calculateTax(1.39, manitoba as never, true, account.account_type === 'expense' ? 'withdrawal' : 'deposit'),
    [account.account_type],
  );
  const planned = planBankTaxLines({
    transactionType: 'deposit',
    offsetAccounts: [account],
    taxBreakdown: tax.taxBreakdown,
    taxCode: manitoba,
    accounts: chart,
  });
  const journal = expenseRefundJournal({
    bankAccountId: 'bank',
    offsetLines: [{ accountId: account.id, amount: tax.subtotal, memo: account.name }],
    taxLines: planned.lines,
    description: 'correction',
    payee: 'Opos Canva',
  });
  const names = Object.fromEntries(chart.map((row) => [row.id, row.name]));
  const usesHeader = journal.some((line) => line.account_id === 'taxes-payable');

  return (
    <main className="mx-auto max-w-xl p-6 font-sans">
      <h1 className="text-lg font-semibold">Edit Transaction</h1>
      <p className="text-sm text-muted-foreground">Deposit of $1.39 with Manitoba GST and PST.</p>
      <label className="mt-4 block text-sm font-medium" htmlFor="offset-account">GL Account for Posting</label>
      <select
        id="offset-account"
        className="mt-1 w-full rounded-md border px-3 py-2"
        value={accountId}
        onChange={(event) => setAccountId(event.target.value)}
      >
        <option value="office">6-03-105 Office</option>
        <option value="sales">4-01-100 Sales</option>
      </select>
      <p className="mt-2 text-sm text-muted-foreground" data-testid="posting-note">
        {planned.expenseRefund
          ? 'Expense refund: this deposit credits the expense and reverses the sales tax that was paid.'
          : 'This deposit credits income and records the sales tax collected.'}
      </p>
      <section className="mt-4 rounded-lg bg-muted/50 p-3 text-sm" data-testid="tax-breakdown">
        <div className="flex justify-between"><span>Subtotal</span><span>{money(tax.subtotal)}</span></div>
        {tax.taxBreakdown.map((line) => (
          <div key={line.code} className="flex justify-between">
            <span>{line.code} ({line.rate}%)</span>
            <span>+{money(line.amount)}</span>
          </div>
        ))}
        <div className="flex justify-between border-t pt-2 font-medium"><span>Total</span><span>{money(tax.total)}</span></div>
      </section>
      <h2 className="mt-4 text-sm font-medium">Journal entry</h2>
      <ul className="mt-2 space-y-1 text-sm" data-testid="journal-lines">
        {journal.map((line) => (
          <li key={`${line.account_id}-${line.memo}`} className="flex justify-between gap-4">
            <span>{names[line.account_id] || line.account_id}</span>
            <span>{line.debit > 0 ? `Dr ${money(line.debit)}` : `Cr ${money(line.credit)}`}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-sm" data-testid="header-status">
        {planned.error
          ? planned.error
          : usesHeader
            ? 'Posted to the Taxes Payable header.'
            : 'Taxes Payable header was not used.'}
      </p>
    </main>
  );
}
