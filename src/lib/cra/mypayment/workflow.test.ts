import { describe, expect, it } from 'vitest';
import { BUILT_IN_CATALOG, findType, mergeCatalog } from './catalog';
import {
  DEFAULT_POLICY,
  approveBlock,
  bankCandidates,
  businessNumberChecksumOk,
  dashboardTotals,
  findDuplicates,
  paymentJournalLines,
  reviewBlock,
  suggestLiabilityAccount,
  validateDraft,
  type MyPaymentRecord,
  type PaymentDraft,
} from './workflow';

const gst = findType(BUILT_IN_CATALOG, 'business', 'gst_hst')!;

const draft = (over: Partial<PaymentDraft> = {}): PaymentDraft => ({
  payerKind: 'business',
  typeKey: 'gst_hst',
  allocationKey: 'gst_payment',
  businessName: 'Acme Ltd.',
  businessNumber: '123456782',
  programAccount: '123456782RT0001',
  periodLabel: 'October 2026',
  periodStart: '2026-10-01',
  periodEnd: '2026-10-31',
  amount: '5000.00',
  paymentDate: '2026-11-20',
  ...over,
});

const record = (over: Partial<MyPaymentRecord> = {}): MyPaymentRecord => ({
  id: 'p1',
  reference: 'EF-CRA-000001',
  workflow_status: 'awaiting_authorization',
  payer_kind: 'business',
  cra_payment_type: 'gst_hst',
  cra_allocation: 'gst_payment',
  business_name: 'Acme Ltd.',
  business_number: '123456782',
  program_account: '123456782RT0001',
  filing_period_label: 'October 2026',
  period_start: '2026-10-01',
  period_end: '2026-10-31',
  amount: 5000,
  scheduled_for: '2026-11-20',
  bank_account_id: 'bank-1',
  prepared_by: 'alice',
  reviewed_by: null,
  approved_by: null,
  confirmation_number: null,
  paid_at: null,
  journal_entry_id: null,
  bank_transaction_id: null,
  receipt_path: null,
  created_at: '2026-11-15T12:00:00Z',
  ...over,
});

describe('catalog', () => {
  it('lists every CRA business and individual category', () => {
    expect(BUILT_IN_CATALOG.filter((t) => t.payerKind === 'individual')).toHaveLength(5);
    expect(BUILT_IN_CATALOG.filter((t) => t.payerKind === 'business')).toHaveLength(14);
  });

  it('applies overrides: rename, hide and add', () => {
    const merged = mergeCatalog([
      { payer_kind: 'business', type_key: 'gst_hst', label: 'GST/HST (renamed)', program_code: null, allocations: null, hidden: false },
      { payer_kind: 'business', type_key: 'luxury_tax', label: null, program_code: null, allocations: null, hidden: true },
      { payer_kind: 'business', type_key: 'new_levy', label: 'New levy', program_code: 'RE', allocations: [{ key: 'levy_balance', label: 'Levy balance' }], hidden: false },
    ]);
    expect(findType(merged, 'business', 'gst_hst')?.label).toBe('GST/HST (renamed)');
    expect(findType(merged, 'business', 'luxury_tax')).toBeUndefined();
    expect(findType(merged, 'business', 'new_levy')?.allocations[0].key).toBe('levy_balance');
  });

  it('ignores a new category with no valid allocation', () => {
    const merged = mergeCatalog([
      { payer_kind: 'business', type_key: 'broken', label: 'Broken', program_code: null, allocations: [{ key: 'X!', label: '' }], hidden: false },
    ]);
    expect(findType(merged, 'business', 'broken')).toBeUndefined();
  });
});

describe('validateDraft', () => {
  it('accepts a complete GST/HST payment', () => {
    const result = validateDraft(draft(), gst, DEFAULT_POLICY, '2026-11-16');
    expect(result.errors).toEqual({});
    expect(result.ok).toBe(true);
  });

  it('rejects an allocation from another tax type', () => {
    const result = validateDraft(draft({ allocationKey: 't2_instalment' }), gst, DEFAULT_POLICY, '2026-11-16');
    expect(result.errors.allocationKey).toMatch(/does not belong/);
  });

  it('rejects a payroll account for a GST/HST payment', () => {
    const result = validateDraft(draft({ programAccount: '123456782RP0001' }), gst, DEFAULT_POLICY, '2026-11-16');
    expect(result.errors.programAccount).toMatch(/RT account/);
  });

  it('rejects an account under a different business number', () => {
    const result = validateDraft(draft({ programAccount: '999999998RT0001' }), gst, DEFAULT_POLICY, '2026-11-16');
    expect(result.errors.programAccount).toMatch(/does not start/);
  });

  it('normalizes spaces and lowercase in the program account', () => {
    const result = validateDraft(draft({ programAccount: '123456782 rt 0001' }), gst, DEFAULT_POLICY, '2026-11-16');
    expect(result.errors.programAccount).toBeUndefined();
  });

  it('rejects zero, negative and malformed amounts', () => {
    expect(validateDraft(draft({ amount: '0' }), gst, DEFAULT_POLICY, '2026-11-16').errors.amount).toBeDefined();
    expect(validateDraft(draft({ amount: '-5' }), gst, DEFAULT_POLICY, '2026-11-16').errors.amount).toBeDefined();
    expect(validateDraft(draft({ amount: '12.345' }), gst, DEFAULT_POLICY, '2026-11-16').errors.amount).toBeDefined();
    expect(validateDraft(draft({ amount: '$5,000.00' }), gst, DEFAULT_POLICY, '2026-11-16').errors.amount).toBeUndefined();
  });

  it('enforces the organization payment limit', () => {
    const result = validateDraft(draft({ amount: '20000' }), gst, { ...DEFAULT_POLICY, max_payment_amount: 10000 }, '2026-11-16');
    expect(result.errors.amount).toMatch(/limit/);
  });

  it('warns about a failed check digit without blocking', () => {
    const result = validateDraft(draft({ businessNumber: '123456789', programAccount: '123456789RT0001' }), gst, DEFAULT_POLICY, '2026-11-16');
    expect(result.ok).toBe(true);
    expect(result.warnings.join(' ')).toMatch(/check-digit/);
  });

  it('needs no program account for an individual', () => {
    const t1 = findType(BUILT_IN_CATALOG, 'individual', 't1');
    const result = validateDraft(draft({ payerKind: 'individual', typeKey: 't1', allocationKey: 'balance_owing', businessNumber: '', programAccount: '', periodLabel: '' }), t1, DEFAULT_POLICY, '2026-11-16');
    expect(result.ok).toBe(true);
  });
});

describe('business number check digit', () => {
  it('passes a valid number and fails a typo', () => {
    expect(businessNumberChecksumOk('123456782')).toBe(true);
    expect(businessNumberChecksumOk('123456783')).toBe(false);
  });
});

describe('findDuplicates', () => {
  const now = new Date('2026-11-16T00:00:00Z');

  it('flags the same account, allocation, period and amount', () => {
    const result = findDuplicates({ ...record(), id: undefined }, [record()], 45, now);
    expect(result.exact).toHaveLength(1);
    expect(result.similar).toHaveLength(0);
  });

  it('separates a different amount as similar', () => {
    const result = findDuplicates({ ...record(), id: undefined, amount: 2500 }, [record()], 45, now);
    expect(result.exact).toHaveLength(0);
    expect(result.similar).toHaveLength(1);
  });

  it('ignores cancelled and failed payments, other periods and old payments', () => {
    const rows = [
      record({ id: 'a', workflow_status: 'cancelled' }),
      record({ id: 'b', workflow_status: 'payment_failed' }),
      record({ id: 'c', filing_period_label: 'September 2026' }),
      record({ id: 'd', created_at: '2026-01-01T00:00:00Z' }),
    ];
    const result = findDuplicates({ ...record(), id: undefined }, rows, 45, now);
    expect(result.exact).toHaveLength(0);
    expect(result.similar).toHaveLength(0);
  });
});

describe('approvals', () => {
  it('blocks the preparer from approving when duties are separated', () => {
    expect(approveBlock(record(), { userId: 'alice', role: 'owner' }, DEFAULT_POLICY)).toMatch(/prepared/);
    expect(approveBlock(record(), { userId: 'bob', role: 'owner' }, DEFAULT_POLICY)).toBeNull();
  });

  it('lets the preparer approve when the policy allows it', () => {
    expect(approveBlock(record(), { userId: 'alice', role: 'owner' }, { ...DEFAULT_POLICY, separate_duties: false })).toBeNull();
  });

  it('blocks roles outside the approver list', () => {
    expect(approveBlock(record(), { userId: 'bob', role: 'accountant' }, DEFAULT_POLICY)).toMatch(/role/);
  });

  it('requires a review above the threshold, by a different person', () => {
    const policy = { ...DEFAULT_POLICY, review_threshold: 1000 };
    expect(approveBlock(record(), { userId: 'bob', role: 'owner' }, policy)).toMatch(/review/);
    expect(reviewBlock(record(), { userId: 'carol', role: 'accountant' }, policy)).toBeNull();
    const reviewed = record({ reviewed_by: 'carol' });
    expect(approveBlock(reviewed, { userId: 'carol', role: 'owner' }, policy)).toMatch(/different person/);
    expect(approveBlock(reviewed, { userId: 'bob', role: 'owner' }, policy)).toBeNull();
  });
});

describe('accounting', () => {
  it('debits the liability and credits the bank', () => {
    const lines = paymentJournalLines({ amount: 5000, liabilityAccountId: 'gst', bankGlAccountId: 'bank', memo: 'EF-CRA-000001' });
    expect(lines).toEqual([
      { account_id: 'gst', debit: 5000, credit: 0, memo: 'EF-CRA-000001' },
      { account_id: 'bank', debit: 0, credit: 5000, memo: 'EF-CRA-000001' },
    ]);
  });

  it('refuses the same account on both sides', () => {
    expect(() => paymentJournalLines({ amount: 5, liabilityAccountId: 'x', bankGlAccountId: 'x', memo: '' })).toThrow();
  });

  it('suggests the GST/HST payable account by name and never guesses', () => {
    const accounts = [
      { id: 'a', code: '1000', name: 'Chequing', account_type: 'asset' },
      { id: 'b', code: '2200', name: 'GST/HST Payable', account_type: 'liability' },
    ];
    expect(suggestLiabilityAccount(gst, accounts)).toBe('b');
    expect(suggestLiabilityAccount(gst, [accounts[0]])).toBeNull();
  });
});

describe('bankCandidates', () => {
  const paid = record({ workflow_status: 'payment_completed', paid_at: '2026-11-20T00:00:00Z', confirmation_number: 'C123', journal_entry_id: 'je-1' });
  const line = (over: Record<string, unknown> = {}) => ({
    id: 't1', bank_account_id: 'bank-1', amount: -5000, transaction_date: '2026-11-21',
    description: 'RECEIVER GENERAL', payee_payor: null, reference: null, transaction_type: 'debit',
    journal_entry_id: null, status: 'pending', ...over,
  });

  it('matches an outflow of the same amount near the payment date', () => {
    const result = bankCandidates(paid, [line()]);
    expect(result).toHaveLength(1);
    expect(result[0].alreadyPosted).toBe(false);
  });

  it('skips deposits, other amounts, other banks and far dates', () => {
    const result = bankCandidates(paid, [
      line({ id: 'x1', amount: 5000, transaction_type: 'credit' }),
      line({ id: 'x2', amount: -4999.99 }),
      line({ id: 'x3', bank_account_id: 'bank-2' }),
      line({ id: 'x4', transaction_date: '2026-12-30' }),
    ]);
    expect(result).toHaveLength(0);
  });

  it('marks a line already posted on its own', () => {
    expect(bankCandidates(paid, [line({ journal_entry_id: 'other-je', status: 'matched' })])[0].alreadyPosted).toBe(true);
  });
});

describe('dashboardTotals', () => {
  it('counts completed, pending, failed and unreconciled', () => {
    const totals = dashboardTotals([
      record({ id: '1', workflow_status: 'reconciled', amount: 100 }),
      record({ id: '2', workflow_status: 'payment_completed', amount: 50.25 }),
      record({ id: '3', workflow_status: 'payment_initiated', amount: 10 }),
      record({ id: '4', workflow_status: 'payment_failed' }),
      record({ id: '5', workflow_status: 'draft' }),
    ]);
    expect(totals).toMatchObject({ totalPaid: 150.25, completedCount: 2, pendingCount: 1, pendingAmount: 10, failedCount: 1, draftCount: 1, unreconciledCount: 1 });
  });
});
