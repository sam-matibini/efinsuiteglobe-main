import { describe, expect, it } from 'vitest';
import { countRuleScopes, ruleCanActOn, ruleGlTarget, ruleScopeFor } from './ruleEligibility';
import { analyzeTransactions } from '@/hooks/useRuleAnalysis';
import { analyzeCCTransactions } from '@/hooks/useCreditCardRuleAnalysis';
import type { BankTransaction } from '@/hooks/useBankTransactions';
import type { CreditCardTransaction } from '@/hooks/useCreditCards';
import type { TransactionRule } from '@/hooks/useTransactionRules';

const bank = (over: Partial<BankTransaction>): BankTransaction => ({
  id: 'tx', bank_account_id: 'ba', transaction_date: '2026-04-14', description: 'WQ414 TFR-TO 5011164', amount: -300,
  transaction_type: 'withdrawal', status: 'unmatched', category: 'Transfer', matched_invoice_id: null, matched_bill_id: null,
  gl_account_id: null, journal_entry_id: null, memo: null, reference: null, payee_payor: null, customer_id: null,
  is_cleared: false, cleared_at: null, imported_at: null, created_at: '', updated_at: '', ...over,
});

const rule = (over: Partial<TransactionRule>): TransactionRule => ({
  id: 'r', name: 'Transfers', is_active: true, priority: 1, logic_operator: 'and', matches_count: 0,
  conditions: [{ id: 'c', field: 'description', operator: 'contains', value: 'TFR' }],
  actions: [{ type: 'categorize', category: 'Due to shareholder', glAccountId: 'gl-due', glAccountName: 'Due to shareholder' }],
  ...over,
} as TransactionRule);

const postingRule = rule({
  actions: [
    { type: 'categorize', category: 'Due to shareholder', glAccountId: 'gl-due', glAccountName: 'Due to shareholder' },
    { type: 'post_to_gl', glAccountId: 'gl-due', glAccountName: 'Due to shareholder' },
  ],
});

describe('which transactions rules act on', () => {
  it('includes unmatched lines even when the bank already gave them a category', () => {
    expect(ruleScopeFor({ status: 'unmatched' })).toBe('unmatched');
    expect(ruleScopeFor({ status: 'pending' })).toBe('unmatched');
  });

  it('includes matched lines that are not posted to the GL', () => {
    expect(ruleScopeFor({ status: 'matched', journal_entry_id: null })).toBe('not_posted');
    expect(ruleScopeFor({ status: 'matched', journal_entry_id: 'je' })).toBeNull();
  });

  it('never touches reconciled lines or lines matched to an invoice or bill', () => {
    expect(ruleScopeFor({ status: 'reconciled' })).toBeNull();
    expect(ruleScopeFor({ status: 'matched', matched_invoice_id: 'inv' })).toBeNull();
    expect(ruleScopeFor({ status: 'unmatched', matched_bill_id: 'bill' })).toBeNull();
  });

  it('keeps an already-posted unmatched line out unless processing reverses the old entry', () => {
    expect(ruleScopeFor({ status: 'unmatched', journal_entry_id: 'je' })).toBeNull();
    expect(ruleScopeFor({ status: 'unmatched', journal_entry_id: 'je' }, { replacesExistingPosting: true })).toBe('unmatched');
  });

  it('acts on not-posted matched lines only when the rule posts', () => {
    expect(ruleCanActOn('unmatched', false)).toBe(true);
    expect(ruleCanActOn('not_posted', false)).toBe(false);
    expect(ruleCanActOn('not_posted', true)).toBe(true);
  });

  it('counts both groups', () => {
    expect(countRuleScopes([{ status: 'unmatched' }, { status: 'matched' }, { status: 'matched', journal_entry_id: 'je' }, { status: 'reconciled' }]))
      .toEqual({ unmatched: 1, notPosted: 1, total: 2 });
  });

  it('reads the GL account from the categorize action when there is no post action', () => {
    expect(ruleGlTarget(rule({}).actions)).toEqual({ category: 'Due to shareholder', glAccountId: 'gl-due', glAccountName: 'Due to shareholder', willPostToGL: false });
    expect(ruleGlTarget(postingRule.actions).willPostToGL).toBe(true);
  });
});

describe('analyzing bank transactions', () => {
  it('matches Plaid-categorized unmatched lines that used to be skipped', () => {
    const [result] = analyzeTransactions([bank({})], [rule({})]);
    expect(result.matchedRule?.id).toBe('r');
    expect(result.glAccountId).toBe('gl-due');
    expect(result.willPostToGL).toBe(false);
  });

  it('posts matched-but-unposted lines only with a posting rule', () => {
    const tx = bank({ status: 'matched', category: 'Due to shareholder' });
    expect(analyzeTransactions([tx], [rule({})])[0].matchedRule).toBeNull();
    const [result] = analyzeTransactions([tx], [postingRule]);
    expect(result.matchedRule?.id).toBe('r');
    expect(result.willPostToGL).toBe(true);
  });

  it('falls through to a lower-priority posting rule for a not-posted line', () => {
    const tx = bank({ status: 'matched' });
    const [result] = analyzeTransactions([tx], [rule({ id: 'cat-only', priority: 9 }), { ...postingRule, id: 'post', priority: 1 }]);
    expect(result.matchedRule?.id).toBe('post');
  });
});

describe('analyzing credit card transactions', () => {
  const cc = (over: Partial<CreditCardTransaction>): CreditCardTransaction => ({
    id: 'cc', credit_card_id: 'card', transaction_date: '2026-04-16', posted_date: null, description: 'MANUS AI TFR', amount: 298.93,
    transaction_type: 'charge', category: 'Food and Drink', merchant_category_code: null, payee_payor: null, memo: null, reference: null,
    is_cleared: false, cleared_at: null, gl_account_id: null, journal_entry_id: null, status: 'unmatched', imported_at: null,
    created_at: '', updated_at: '', ...over,
  });

  it('includes categorized unmatched charges and skips ones already posted', () => {
    const results = analyzeCCTransactions([cc({}), cc({ id: 'posted', journal_entry_id: 'je' })], [rule({})]);
    expect(results.map((r) => r.transaction.id)).toEqual(['cc']);
    expect(results[0].matchedRule?.id).toBe('r');
  });
});
