import { describe, expect, it } from 'vitest';
import { hasAccountingCategory, isBankTransactionLocked } from './bankTransactionLock';

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

  it('locks a cleared transaction after it is posted or assigned a GL account', () => {
    expect(isBankTransactionLocked({
      status: 'unmatched',
      is_cleared: true,
      gl_account_id: 'acct-1',
    })).toBe(true);
    expect(isBankTransactionLocked({
      status: 'matched',
      is_cleared: true,
      journal_entry_id: 'je-1',
    })).toBe(true);
  });

  it('locks an explicit reconciliation even when the category is empty', () => {
    expect(isBankTransactionLocked({ status: 'reconciled', is_cleared: false, category: null })).toBe(true);
  });

  it('treats placeholder categories as not categorized', () => {
    expect(hasAccountingCategory('Uncategorized')).toBe(false);
    expect(hasAccountingCategory('Shops')).toBe(true);
    expect(hasAccountingCategory(null)).toBe(false);
  });
});
