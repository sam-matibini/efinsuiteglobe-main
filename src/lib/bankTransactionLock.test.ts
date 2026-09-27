import { describe, expect, it } from 'vitest';
import { allowUnreconciledBankUpdate, hasAccountingCategory, isBankTransactionLocked } from './bankTransactionLock';

describe('bank transaction lock', () => {
  it('does not lock a cleared download that has not been categorized', () => {
    expect(isBankTransactionLocked({
      status: 'unmatched',
      is_cleared: true,
      category: 'Uncategorized',
      gl_account_id: null,
      journal_entry_id: null,
    })).toBe(false);
    expect(isBankTransactionLocked({
      status: 'unmatched',
      is_cleared: true,
      category: 'Shops',
      gl_account_id: null,
      journal_entry_id: null,
    })).toBe(false);
  });

  it('keeps a posted or rule-categorized transaction editable', () => {
    expect(isBankTransactionLocked({
      status: 'unmatched',
      is_cleared: true,
      gl_account_id: 'acct-1',
    })).toBe(false);
    expect(isBankTransactionLocked({
      status: 'matched',
      is_cleared: true,
      journal_entry_id: 'je-1',
      gl_account_id: 'acct-1',
    })).toBe(false);
    expect(isBankTransactionLocked({
      status: 'pending',
      is_cleared: false,
      journal_entry_id: 'je-1',
    })).toBe(false);
  });

  it('locks an explicit reconciliation even when the category is empty', () => {
    expect(isBankTransactionLocked({ status: 'reconciled', is_cleared: false, category: null })).toBe(true);
  });

  it('clears a posted download in the same update so the database trigger allows the edit', () => {
    expect(allowUnreconciledBankUpdate(
      { gl_account_id: 'acct-1', status: 'matched' },
      { status: 'unmatched', is_cleared: true },
    )).toEqual({
      gl_account_id: 'acct-1',
      status: 'matched',
      is_cleared: false,
      cleared_at: null,
    });
  });

  it('does not unlock a transaction whose status is reconciled', () => {
    expect(allowUnreconciledBankUpdate(
      { category: 'Shops' },
      { status: 'reconciled', is_cleared: true },
    )).toEqual({ category: 'Shops' });
  });

  it('leaves an uncleared transaction unchanged', () => {
    expect(allowUnreconciledBankUpdate(
      { category: 'Shops' },
      { status: 'unmatched', is_cleared: false },
    )).toEqual({ category: 'Shops' });
  });

  it('treats placeholder categories as not categorized', () => {
    expect(hasAccountingCategory('Uncategorized')).toBe(false);
    expect(hasAccountingCategory('Shops')).toBe(true);
    expect(hasAccountingCategory(null)).toBe(false);
  });
});
