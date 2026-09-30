import { describe, expect, it } from 'vitest';
import { analyzeTransactions } from '@/hooks/useRuleAnalysis';
import { analyzeCCTransactions } from '@/hooks/useCreditCardRuleAnalysis';
import type { BankTransaction } from '@/hooks/useBankTransactions';
import type { CreditCardTransaction } from '@/hooks/useCreditCards';
import type { TransactionRule } from '@/hooks/useTransactionRules';
import { isEligibleForTransactionRules } from './transactionRuleEligibility';

function bankLine(overrides: Partial<BankTransaction> = {}): BankTransaction {
  return {
    id: 'tx-1',
    bank_account_id: 'bank-1',
    transaction_date: '2026-09-21',
    description: 'Credit Memo FREE INTERAC E-TRANSFER',
    amount: 100,
    transaction_type: 'deposit',
    status: 'unmatched',
    category: 'Transfer',
    matched_invoice_id: null,
    matched_bill_id: null,
    gl_account_id: null,
    journal_entry_id: null,
    memo: null,
    reference: 'PLAID-8r82eXAog8tV30oyJ3GVUnAL7dqy41jjzg2a0',
    payee_payor: null,
    customer_id: null,
    is_cleared: false,
    cleared_at: null,
    imported_at: '2026-09-21T00:00:00.000Z',
    created_at: '2026-09-21T00:00:00.000Z',
    updated_at: '2026-09-21T00:00:00.000Z',
    ...overrides,
  };
}

function interacRule(): TransactionRule {
  return {
    id: 'rule-1',
    organization_id: 'org-1',
    name: 'Interac e-Transfer',
    description: null,
    is_active: true,
    priority: 10,
    logic_operator: 'and',
    matches_count: 0,
    last_matched_at: null,
    created_at: '2026-09-01T00:00:00.000Z',
    updated_at: '2026-09-01T00:00:00.000Z',
    conditions: [
      { id: 'c1', field: 'description', operator: 'contains', value: 'INTERAC E-TRANSFER' },
    ],
    actions: [
      { type: 'categorize', category: 'E-Transfer Income' },
      { type: 'post_to_gl', glAccountId: 'gl-income', glAccountName: 'E-Transfer Income' },
    ],
  };
}

describe('transaction rule eligibility', () => {
  it('includes unmatched lines that already have a feed category', () => {
    expect(isEligibleForTransactionRules(bankLine())).toBe(true);
    expect(isEligibleForTransactionRules(bankLine({ category: null, status: 'pending' }))).toBe(true);
    expect(isEligibleForTransactionRules(bankLine({ status: '' as BankTransaction['status'] }))).toBe(true);
  });

  it('skips lines that are already posted, matched, or reconciled', () => {
    expect(isEligibleForTransactionRules(bankLine({ journal_entry_id: 'je-1' }))).toBe(false);
    expect(isEligibleForTransactionRules(bankLine({ status: 'reconciled', category: null }))).toBe(false);
    expect(isEligibleForTransactionRules(bankLine({ status: 'matched', category: 'Sales' }))).toBe(false);
    expect(isEligibleForTransactionRules(bankLine({ matched_invoice_id: 'inv-1' }))).toBe(false);
    expect(isEligibleForTransactionRules(bankLine({ matched_bill_id: 'bill-1' }))).toBe(false);
  });
});

describe('analyzeTransactions', () => {
  it('categorizes and marks an unmatched Transfer line for GL posting', () => {
    const open = bankLine();
    const posted = bankLine({ id: 'tx-posted', journal_entry_id: 'je-1' });
    const other = bankLine({
      id: 'tx-other',
      description: 'Customer Transfer Cr. PC FROM *******8219',
      category: 'Transfer',
    });

    const results = analyzeTransactions([open, posted, other], [interacRule()]);

    expect(results.map((result) => result.transaction.id)).toEqual(['tx-1', 'tx-other']);
    expect(results[0]).toMatchObject({
      category: 'E-Transfer Income',
      glAccountId: 'gl-income',
      glAccountName: 'E-Transfer Income',
      willPostToGL: true,
    });
    expect(results[0].matchedRule?.id).toBe('rule-1');
    expect(results[1].matchedRule).toBeNull();
  });
});

describe('analyzeCCTransactions', () => {
  it('includes an unmatched card line that already has a feed category', () => {
    const tx = {
      id: 'cc-1',
      credit_card_id: 'card-1',
      transaction_date: '2026-09-21',
      posted_date: null,
      description: 'INTERAC E-TRANSFER FEE',
      amount: 1.5,
      transaction_type: 'fee',
      category: 'Transfer',
      merchant_category_code: null,
      payee_payor: null,
      memo: null,
      reference: 'PLAID-fee',
      is_cleared: false,
      cleared_at: null,
      gl_account_id: null,
      journal_entry_id: null,
      status: 'unmatched',
      imported_at: null,
      created_at: '2026-09-21T00:00:00.000Z',
      updated_at: '2026-09-21T00:00:00.000Z',
    } satisfies CreditCardTransaction;

    const [result] = analyzeCCTransactions([tx], [interacRule()]);
    expect(result.matchedRule?.id).toBe('rule-1');
    expect(result.category).toBe('E-Transfer Income');
    expect(result.willPostToGL).toBe(true);
  });
});
