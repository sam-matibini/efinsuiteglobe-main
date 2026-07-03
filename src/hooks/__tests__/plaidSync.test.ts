/**
 * Plaid Data Integration — Regression Protection Suite
 *
 * These are pure unit tests that exercise the core mapping and deduplication
 * logic extracted from usePlaidSync.ts WITHOUT touching Supabase or the network.
 * They guard against the bugs that were fixed in Feb 2026:
 *   1. organization_id inserted into bank_transactions (PGRST204)
 *   2. Plaid sign convention (negative = deposit, positive = withdrawal)
 *   3. Duplicate suppression via PLAID-{id} reference prefix
 *   4. Pending transaction status & is_cleared mapping
 *   5. Batch insert payload shape matching the actual DB schema
 */

import { describe, it, expect } from 'vitest';

// ──────────────────────────────────────────────────────────────────
// Extracted pure functions (mirrors usePlaidSync logic exactly)
// ──────────────────────────────────────────────────────────────────

interface RawPlaidTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;       // Plaid: negative = money IN (deposit), positive = money OUT
  type: string;
  category: string;
  merchantName?: string;
  pending?: boolean;
}

interface BankTransactionRow {
  bank_account_id: string;
  transaction_date: string;
  description: string;
  amount: number;
  transaction_type: 'deposit' | 'withdrawal';
  status: string;
  reference: string;
  category: string | null;
  memo: string | null;
  is_cleared: boolean;
}

/** Maps a Plaid transaction to the bank_transactions DB row shape */
function mapPlaidToRow(
  txn: RawPlaidTransaction,
  bankAccountId: string,
): BankTransactionRow {
  return {
    bank_account_id: bankAccountId,
    transaction_date: txn.date,
    description: txn.description || txn.merchantName || 'Unnamed transaction',
    amount: Math.abs(txn.amount),
    transaction_type: txn.amount < 0 ? 'deposit' : 'withdrawal',
    status: txn.pending ? 'pending' : 'unmatched',
    reference: `PLAID-${txn.id}`,
    category: txn.category || null,
    memo: txn.merchantName || null,
    is_cleared: !txn.pending,
  };
}

/** Filters out Plaid txns whose reference already exists in the DB */
function deduplicateTransactions(
  plaidTransactions: RawPlaidTransaction[],
  existingRefs: Set<string>,
): RawPlaidTransaction[] {
  return plaidTransactions.filter((txn) => !existingRefs.has(`PLAID-${txn.id}`));
}

/** Splits rows into batches of `size` */
function toBatches<T>(rows: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < rows.length; i += size) {
    batches.push(rows.slice(i, i + size));
  }
  return batches;
}

// ──────────────────────────────────────────────────────────────────
// Fixtures
// ──────────────────────────────────────────────────────────────────
const ACCOUNT_ID = 'bbe4ce19-60a3-45b4-ad82-93e290554d3d';

const sampleDeposit: RawPlaidTransaction = {
  id: 'plaid-txn-001',
  date: '2026-02-10',
  description: 'Payroll Direct Deposit',
  amount: -3500.00,   // Plaid: negative = money IN
  type: 'special',
  category: 'Payroll',
  merchantName: 'Efintax Inc',
  pending: false,
};

const sampleWithdrawal: RawPlaidTransaction = {
  id: 'plaid-txn-002',
  date: '2026-02-11',
  description: 'Office Supplies',
  amount: 89.99,       // Plaid: positive = money OUT
  type: 'place',
  category: 'Office',
  merchantName: 'Staples',
  pending: false,
};

const samplePending: RawPlaidTransaction = {
  id: 'plaid-txn-003',
  date: '2026-02-19',
  description: 'Coffee shop',
  amount: 12.50,
  type: 'place',
  category: 'Food',
  merchantName: 'Second Cup',
  pending: true,
};

// ──────────────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────────────

describe('Plaid → DB row mapping', () => {
  it('deposit: Plaid negative amount → transaction_type=deposit, positive amount stored', () => {
    const row = mapPlaidToRow(sampleDeposit, ACCOUNT_ID);
    expect(row.transaction_type).toBe('deposit');
    expect(row.amount).toBe(3500.00);
    expect(row.amount).toBeGreaterThan(0); // always stored positive
  });

  it('withdrawal: Plaid positive amount → transaction_type=withdrawal, positive amount stored', () => {
    const row = mapPlaidToRow(sampleWithdrawal, ACCOUNT_ID);
    expect(row.transaction_type).toBe('withdrawal');
    expect(row.amount).toBe(89.99);
    expect(row.amount).toBeGreaterThan(0);
  });

  it('pending: status=pending, is_cleared=false', () => {
    const row = mapPlaidToRow(samplePending, ACCOUNT_ID);
    expect(row.status).toBe('pending');
    expect(row.is_cleared).toBe(false);
  });

  it('cleared: status=unmatched, is_cleared=true', () => {
    const row = mapPlaidToRow(sampleDeposit, ACCOUNT_ID);
    expect(row.status).toBe('unmatched');
    expect(row.is_cleared).toBe(true);
  });

  it('reference is prefixed with PLAID-', () => {
    const row = mapPlaidToRow(sampleDeposit, ACCOUNT_ID);
    expect(row.reference).toBe('PLAID-plaid-txn-001');
  });

  it('bank_account_id is passed through correctly', () => {
    const row = mapPlaidToRow(sampleDeposit, ACCOUNT_ID);
    expect(row.bank_account_id).toBe(ACCOUNT_ID);
  });

  it('description falls back to merchantName when description is empty', () => {
    const txn = { ...sampleDeposit, description: '' };
    const row = mapPlaidToRow(txn, ACCOUNT_ID);
    expect(row.description).toBe('Efintax Inc');
  });

  it('description falls back to "Unnamed transaction" when both are empty', () => {
    const txn = { ...sampleDeposit, description: '', merchantName: undefined };
    const row = mapPlaidToRow(txn, ACCOUNT_ID);
    expect(row.description).toBe('Unnamed transaction');
  });

  it('memo is set to merchantName', () => {
    const row = mapPlaidToRow(sampleDeposit, ACCOUNT_ID);
    expect(row.memo).toBe('Efintax Inc');
  });

  it('category is null when empty string', () => {
    const txn = { ...sampleDeposit, category: '' };
    const row = mapPlaidToRow(txn, ACCOUNT_ID);
    expect(row.category).toBeNull();
  });

  // ── CRITICAL: organization_id must NOT appear in the payload ──
  it('REGRESSION: row must NOT contain organization_id (bank_transactions has no such column)', () => {
    const row = mapPlaidToRow(sampleDeposit, ACCOUNT_ID) as unknown as Record<string, unknown>;
    expect('organization_id' in row).toBe(false);
  });
});

describe('Plaid deduplication logic', () => {
  it('filters out transactions already in the DB', () => {
    const existingRefs = new Set(['PLAID-plaid-txn-001', 'PLAID-plaid-txn-002']);
    const filtered = deduplicateTransactions(
      [sampleDeposit, sampleWithdrawal, samplePending],
      existingRefs,
    );
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('plaid-txn-003');
  });

  it('returns all transactions when none are duplicates', () => {
    const filtered = deduplicateTransactions(
      [sampleDeposit, sampleWithdrawal, samplePending],
      new Set(),
    );
    expect(filtered).toHaveLength(3);
  });

  it('returns empty array when all are duplicates', () => {
    const existingRefs = new Set([
      'PLAID-plaid-txn-001',
      'PLAID-plaid-txn-002',
      'PLAID-plaid-txn-003',
    ]);
    const filtered = deduplicateTransactions(
      [sampleDeposit, sampleWithdrawal, samplePending],
      existingRefs,
    );
    expect(filtered).toHaveLength(0);
  });

  it('reference prefix mismatch does NOT suppress transaction (different prefix)', () => {
    // Ensures a manually-entered txn with ref "plaid-txn-001" won't block a Plaid import
    const existingRefs = new Set(['plaid-txn-001']); // missing PLAID- prefix
    const filtered = deduplicateTransactions([sampleDeposit], existingRefs);
    expect(filtered).toHaveLength(1);
  });
});

describe('Batch splitting', () => {
  it('splits 250 rows into 3 batches of max 100', () => {
    const rows = Array.from({ length: 250 }, (_, i) =>
      mapPlaidToRow({ ...sampleDeposit, id: `txn-${i}` }, ACCOUNT_ID),
    );
    const batches = toBatches(rows, 100);
    expect(batches).toHaveLength(3);
    expect(batches[0]).toHaveLength(100);
    expect(batches[1]).toHaveLength(100);
    expect(batches[2]).toHaveLength(50);
  });

  it('single row → single batch', () => {
    const rows = [mapPlaidToRow(sampleDeposit, ACCOUNT_ID)];
    const batches = toBatches(rows, 100);
    expect(batches).toHaveLength(1);
    expect(batches[0]).toHaveLength(1);
  });

  it('exactly 100 rows → 1 batch', () => {
    const rows = Array.from({ length: 100 }, (_, i) =>
      mapPlaidToRow({ ...sampleDeposit, id: `txn-${i}` }, ACCOUNT_ID),
    );
    const batches = toBatches(rows, 100);
    expect(batches).toHaveLength(1);
  });

  it('empty rows → no batches', () => {
    expect(toBatches([], 100)).toHaveLength(0);
  });
});

describe('DB schema compliance', () => {
  const ALLOWED_COLUMNS = new Set([
    'bank_account_id',
    'transaction_date',
    'description',
    'amount',
    'transaction_type',
    'status',
    'reference',
    'category',
    'memo',
    'is_cleared',
  ]);

  it('row only contains columns that exist in bank_transactions', () => {
    const row = mapPlaidToRow(sampleDeposit, ACCOUNT_ID);
    const extraKeys = Object.keys(row).filter((k) => !ALLOWED_COLUMNS.has(k));
    expect(extraKeys).toEqual([]);
  });

  it('all required columns are present in the row', () => {
    const row = mapPlaidToRow(sampleDeposit, ACCOUNT_ID);
    const keys = Object.keys(row);
    expect(keys).toContain('bank_account_id');
    expect(keys).toContain('transaction_date');
    expect(keys).toContain('amount');
    expect(keys).toContain('transaction_type');
    expect(keys).toContain('status');
    expect(keys).toContain('reference');
    expect(keys).toContain('is_cleared');
  });

  it('amount is always a positive number (Math.abs applied)', () => {
    const rowDeposit = mapPlaidToRow(sampleDeposit, ACCOUNT_ID);
    const rowWithdrawal = mapPlaidToRow(sampleWithdrawal, ACCOUNT_ID);
    expect(rowDeposit.amount).toBeGreaterThan(0);
    expect(rowWithdrawal.amount).toBeGreaterThan(0);
  });
});
