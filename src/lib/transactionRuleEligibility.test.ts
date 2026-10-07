import { describe, expect, it } from 'vitest';
import { analyzeTransactions } from '@/hooks/useRuleAnalysis';
import type { BankTransaction } from '@/hooks/useBankTransactions';
import type { TransactionRule } from '@/hooks/useTransactionRules';
import { analyzeCCTransactions } from '@/hooks/useCreditCardRuleAnalysis';
import type { CreditCardTransaction } from '@/hooks/useCreditCards';
import { isOpenForTransactionRule } from './transactionRuleEligibility';

function bank(overrides: Partial<BankTransaction>): BankTransaction {
  return {
    id: 'tx',
    bank_account_id: 'bank',
    transaction_date: '2026-10-02',
    description: "SOBEYS #4030",
    amount: -16.79,
    transaction_type: 'withdrawal',
    status: 'unmatched',
    category: 'Shops',
    matched_invoice_id: null,
    matched_bill_id: null,
    gl_account_id: null,
    journal_entry_id: null,
    memo: null,
    reference: null,
    payee_payor: null,
    customer_id: null,
    is_cleared: true,
    cleared_at: null,
    imported_at: null,
    created_at: '2026-10-02',
    updated_at: '2026-10-02',
    ...overrides,
  };
}

const shopsRule: TransactionRule = {
  id: 'rule-shops',
  organization_id: 'org',
  name: 'Sobeys',
  description: null,
  is_active: true,
  priority: 10,
  matches_count: 0,
  last_matched_at: null,
  created_at: '2026-10-01',
  updated_at: '2026-10-01',
  logic_operator: 'and',
  conditions: [{ id: 'c1', field: 'description', operator: 'contains', value: 'SOBEYS' }],
  actions: [{ type: 'categorize', category: 'Groceries' }, { type: 'post_to_gl', glAccountId: 'gl-groceries', glAccountName: 'Groceries' }],
};

describe('transaction rule eligibility', () => {
  it('includes unmatched, pending, and not-posted lines, including ones that already have a category', () => {
    expect(isOpenForTransactionRule(bank({ status: 'unmatched', category: 'Shops' }))).toBe(true);
    expect(isOpenForTransactionRule(bank({ status: 'pending', category: null }))).toBe(true);
    expect(isOpenForTransactionRule(bank({ status: 'matched', category: 'Travel', gl_account_id: 'gl-1' }))).toBe(true);
    expect(isOpenForTransactionRule(bank({ status: 'unmatched', journal_entry_id: 'je-1' }))).toBe(false);
    expect(isOpenForTransactionRule(bank({ status: 'reconciled', journal_entry_id: null }))).toBe(false);
  });

  it('lets a rule see an unmatched categorized bank line that is not posted', () => {
    const results = analyzeTransactions([
      bank({ id: 'sobeys', description: "SOBEYS #4030", status: 'unmatched', category: 'Shops' }),
      bank({ id: 'posted', description: "SOBEYS #4030", status: 'matched', category: 'Shops', journal_entry_id: 'je-posted' }),
      bank({ id: 'hotel', description: 'NEW AVENUE HOTE', status: 'pending', category: 'Travel' }),
    ], [shopsRule]);

    expect(results.map((result) => result.transaction.id)).toEqual(['sobeys', 'hotel']);
    expect(results.find((result) => result.transaction.id === 'sobeys')?.matchedRule?.id).toBe('rule-shops');
    expect(results.find((result) => result.transaction.id === 'sobeys')?.willPostToGL).toBe(true);
  });

  it('lets a rule see a credit-card charge that is unmatched and not posted', () => {
    const charge = {
      id: 'cc-1',
      credit_card_id: 'card',
      transaction_date: '2026-10-02',
      description: 'SOBEYS #4030',
      amount: 16.79,
      transaction_type: 'charge',
      status: 'unmatched',
      category: 'Shops',
      journal_entry_id: null,
      gl_account_id: null,
      payee_payor: null,
      reference: null,
    } as CreditCardTransaction;
    const posted = { ...charge, id: 'cc-posted', journal_entry_id: 'je-1' };
    const results = analyzeCCTransactions([charge, posted], [shopsRule]);
    expect(results.map((result) => result.transaction.id)).toEqual(['cc-1']);
    expect(results[0]?.glAccountId).toBe('gl-groceries');
  });
});