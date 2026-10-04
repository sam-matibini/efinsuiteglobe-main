import { describe, expect, it } from 'vitest';
import {
  draftAfterSideEdit,
  editedJournalAmounts,
  parseJournalAmount,
  seedAmountDrafts,
} from './journalAmountEdit';

const tradePayables = {
  id: 'line-ap',
  debit: 1500,
  credit: 0,
  exchange_rate: 1,
  base_currency_debit: 1500,
  base_currency_credit: 0,
};

const chequing = {
  id: 'line-bank',
  debit: 0,
  credit: 1500,
  exchange_rate: 1,
  base_currency_debit: 0,
  base_currency_credit: 1500,
};

describe('journal amount edit', () => {
  it('parses currency text and blank cells', () => {
    expect(parseJournalAmount('CA$1,500.00')).toBe(1500);
    expect(parseJournalAmount('1,600.5')).toBe(1600.5);
    expect(parseJournalAmount('-')).toBe(0);
    expect(parseJournalAmount('')).toBe(0);
    expect(parseJournalAmount('abc')).toBeNull();
    expect(parseJournalAmount('-5')).toBeNull();
  });

  it('keeps 1500 and 1500 balanced and rejects a one-sided change', () => {
    const original = seedAmountDrafts([tradePayables, chequing]);
    const same = editedJournalAmounts([tradePayables, chequing], original);
    expect(same.balanced).toBe(true);
    expect(same.changed).toBe(false);

    const oneSided = editedJournalAmounts([tradePayables, chequing], {
      ...original,
      'line-ap': { debit: '1600.00', credit: '' },
    });
    expect(oneSided.changed).toBe(true);
    expect(oneSided.balanced).toBe(false);
    expect(oneSided.lines.find((line) => line.id === 'line-ap')?.baseDebit).toBe(1600);

    const both = editedJournalAmounts([tradePayables, chequing], {
      'line-ap': { debit: '1600.00', credit: '' },
      'line-bank': { debit: '', credit: '1600.00' },
    });
    expect(both.valid).toBe(true);
    expect(both.balanced).toBe(true);
    expect(both.lines.map((line) => line.baseDebit - line.baseCredit)).toEqual([1600, -1600]);
  });

  it('clears the other side when an amount is typed', () => {
    expect(draftAfterSideEdit({ debit: '', credit: '1500.00' }, 'debit', '1600')).toEqual({
      debit: '1600',
      credit: '',
    });
    expect(draftAfterSideEdit({ debit: '1500.00', credit: '' }, 'credit', '40')).toEqual({
      debit: '',
      credit: '40',
    });
  });

  it('recomputes base currency only on the lines whose amounts changed', () => {
    const usd = {
      id: 'usd',
      debit: 100,
      credit: 0,
      exchange_rate: 1.35,
      base_currency_debit: 135.01,
      base_currency_credit: 0,
    };
    const cad = {
      id: 'cad',
      debit: 0,
      credit: 135.01,
      exchange_rate: 1,
      base_currency_debit: 0,
      base_currency_credit: 135.01,
    };
    const unchanged = editedJournalAmounts([usd, cad], seedAmountDrafts([usd, cad]));
    expect(unchanged.lines[0].baseDebit).toBe(135.01);
    expect(unchanged.balanced).toBe(true);

    const edited = editedJournalAmounts([usd, cad], {
      usd: { debit: '200.00', credit: '' },
      cad: { debit: '', credit: '270.00' },
    });
    expect(edited.lines[0].baseDebit).toBe(270);
    expect(edited.lines[1].baseCredit).toBe(270);
    expect(edited.balanced).toBe(true);
  });

  it('marks an account change while 1500 and 1500 stay balanced', () => {
    const lines = [
      { ...tradePayables, account_id: 'ap' },
      { ...chequing, account_id: 'bank' },
    ];
    const drafts = seedAmountDrafts(lines);
    const same = editedJournalAmounts(lines, drafts);
    expect(same.changed).toBe(false);
    expect(same.balanced).toBe(true);
    expect(same.lines.map((line) => line.accountId)).toEqual(['ap', 'bank']);

    const moved = editedJournalAmounts(lines, {
      ...drafts,
      'line-ap': { ...drafts['line-ap'], accountId: 'office' },
    });
    expect(moved.changed).toBe(true);
    expect(moved.valid).toBe(true);
    expect(moved.balanced).toBe(true);
    expect(moved.lines.find((line) => line.id === 'line-ap')).toMatchObject({
      accountId: 'office',
      debit: 1500,
      credit: 0,
      baseDebit: 1500,
    });
  });

  it('balances an expense refund to the cent', () => {
    const lines = [
      { id: 'bank', debit: 1.39, credit: 0, exchange_rate: 1, base_currency_debit: 1.39, base_currency_credit: 0 },
      { id: 'office', debit: 0, credit: 1.24, exchange_rate: 1, base_currency_debit: 0, base_currency_credit: 1.24 },
      { id: 'gst', debit: 0, credit: 0.06, exchange_rate: 1, base_currency_debit: 0, base_currency_credit: 0.06 },
      { id: 'pst', debit: 0, credit: 0.09, exchange_rate: 1, base_currency_debit: 0, base_currency_credit: 0.09 },
    ];
    expect(editedJournalAmounts(lines, seedAmountDrafts(lines)).balanced).toBe(true);
  });
});
