import { describe, expect, it } from 'vitest';
import { paidTaxGlChoices, paidTaxGlFieldCopy } from './paidTaxGlAccounts';

const accounts = [
  { id: 'taxes', code: '2-00-000', name: 'Taxes Payable', account_type: 'liability', is_header: true, posting_allowed: false },
  { id: 'gst-pay', code: '2-01-210', name: 'GST/HST Payable', account_type: 'liability' },
  { id: 'gst-itc', code: '1-20-110', name: 'GST/HST Input Tax Credit', account_type: 'asset' },
  { id: 'header-exp', code: '6-00-000', name: 'Expenses', account_type: 'expense', is_header: true, posting_allowed: false },
  { id: 'pst-paid', code: '6-09-210', name: 'PST Paid (Non-Recoverable)', account_type: 'expense' },
  { id: 'office', code: '6-03-105', name: 'Office', account_type: 'expense' },
  { id: 'closed', code: '6-09-999', name: 'Closed Tax', account_type: 'expense', is_active: false },
  { id: 'sales', code: '4-01-100', name: 'Sales', account_type: 'income' },
];

describe('paid tax GL accounts', () => {
  it('offers expense accounts when the tax is not recoverable', () => {
    const choices = paidTaxGlChoices(accounts, { isRecoverable: false });
    expect(choices.expenses.map((account) => account.id)).toEqual(['office', 'pst-paid']);
    expect(choices.assets.map((account) => account.id)).toEqual(['gst-itc']);
    expect(choices.expenses.concat(choices.assets).map((account) => account.name)).not.toContain('Taxes Payable');
    expect(choices.expenses.map((account) => account.name)).not.toContain('Expenses');
    expect(choices.expenses.map((account) => account.name)).not.toContain('Closed Tax');
  });

  it('keeps recoverable ITC on asset accounts', () => {
    const choices = paidTaxGlChoices(accounts, { isRecoverable: true });
    expect(choices.expenses).toEqual([]);
    expect(choices.assets.map((account) => account.id)).toEqual(['gst-itc']);
  });

  it('keeps a stored expense visible after recoverable is turned on', () => {
    const choices = paidTaxGlChoices(accounts, { isRecoverable: true, selectedId: 'pst-paid' });
    expect(choices.expenses.map((account) => account.id)).toEqual(['pst-paid']);
    expect(choices.assets.map((account) => account.id)).toEqual(['gst-itc']);
  });

  it('describes an income-statement expense for non-recoverable tax', () => {
    expect(paidTaxGlFieldCopy(false).label).toBe('GL Paid Account (Expense)');
    expect(paidTaxGlFieldCopy(false).placeholder).toBe('Select expense account');
    expect(paidTaxGlFieldCopy(false).helper).toMatch(/income statement/);
    expect(paidTaxGlFieldCopy(true).label).toBe('GL Paid / ITC Account (Asset)');
  });
});
