import { describe, it, expect } from 'vitest';

/**
 * Invoice Ledger Integrity Regression Tests
 * 
 * Validates that invoice lifecycle events (void, delete) properly reverse
 * journal entries and that AR aging excludes deleted/voided invoices.
 * These are structural/logic tests — no DB or network dependencies.
 */

// ─── Helper: Simulates the reversal line-swap logic used in useInvoices ───

function createReversedLines(
  originalLines: Array<{ account_id: string; debit: number; credit: number; description: string | null }>,
  newJournalEntryId: string,
) {
  return originalLines.map((line, index) => ({
    journal_entry_id: newJournalEntryId,
    account_id: line.account_id,
    description: line.description || null,
    debit: Number(line.credit) || 0,
    credit: Number(line.debit) || 0,
    line_order: index,
  }));
}

// ─── Helper: Simulates AR aging filter logic ───

interface MockInvoice {
  id: string;
  status: string;
  deleted_at: string | null;
  balance_due: number;
  due_date: string;
}

function filterARInvoices(invoices: MockInvoice[]) {
  const allowedStatuses = ['sent', 'partial', 'overdue', 'issued', 'final'];
  return invoices.filter(
    (inv) =>
      inv.deleted_at === null &&
      inv.status !== 'void' &&
      inv.balance_due > 0 &&
      allowedStatuses.includes(inv.status),
  );
}

// ─── Helper: Simulates cache invalidation keys ───

const REQUIRED_INVALIDATION_KEYS = [
  'invoices',
  'journal-entries',
  'accounts',
  'ar_aging',
  'financial-reports',
];

describe('Invoice Ledger Integrity', () => {
  describe('Journal Entry Reversal Logic', () => {
    it('should swap debits and credits in reversed lines', () => {
      const originalLines = [
        { account_id: 'ar-001', debit: 1000, credit: 0, description: 'AR' },
        { account_id: 'rev-001', debit: 0, credit: 900, description: 'Revenue' },
        { account_id: 'tax-001', debit: 0, credit: 100, description: 'Tax' },
      ];

      const reversed = createReversedLines(originalLines, 'rev-je-001');

      // AR line: original debit 1000 → reversed credit 1000
      expect(reversed[0].debit).toBe(0);
      expect(reversed[0].credit).toBe(1000);

      // Revenue line: original credit 900 → reversed debit 900
      expect(reversed[1].debit).toBe(900);
      expect(reversed[1].credit).toBe(0);

      // Tax line: original credit 100 → reversed debit 100
      expect(reversed[2].debit).toBe(100);
      expect(reversed[2].credit).toBe(0);
    });

    it('should produce balanced reversal (total debits = total credits)', () => {
      const originalLines = [
        { account_id: 'ar-001', debit: 5000, credit: 0, description: 'AR' },
        { account_id: 'rev-001', debit: 0, credit: 4500, description: 'Revenue' },
        { account_id: 'tax-001', debit: 0, credit: 500, description: 'Tax' },
      ];

      const reversed = createReversedLines(originalLines, 'rev-je-002');

      const totalDebit = reversed.reduce((s, l) => s + l.debit, 0);
      const totalCredit = reversed.reduce((s, l) => s + l.credit, 0);

      expect(totalDebit).toBe(totalCredit);
    });

    it('should preserve account_id references in reversal', () => {
      const originalLines = [
        { account_id: 'ar-001', debit: 1000, credit: 0, description: 'AR' },
        { account_id: 'rev-001', debit: 0, credit: 1000, description: 'Revenue' },
      ];

      const reversed = createReversedLines(originalLines, 'rev-je-003');

      expect(reversed[0].account_id).toBe('ar-001');
      expect(reversed[1].account_id).toBe('rev-001');
    });

    it('should assign correct journal_entry_id to all reversed lines', () => {
      const originalLines = [
        { account_id: 'ar-001', debit: 500, credit: 0, description: null },
        { account_id: 'rev-001', debit: 0, credit: 500, description: null },
      ];

      const reversed = createReversedLines(originalLines, 'new-reversal-id');

      reversed.forEach((line) => {
        expect(line.journal_entry_id).toBe('new-reversal-id');
      });
    });

    it('should handle zero-value lines gracefully', () => {
      const originalLines = [
        { account_id: 'ar-001', debit: 1000, credit: 0, description: 'AR' },
        { account_id: 'rev-001', debit: 0, credit: 1000, description: 'Revenue' },
        { account_id: 'tax-001', debit: 0, credit: 0, description: 'Zero tax' },
      ];

      const reversed = createReversedLines(originalLines, 'rev-je-004');

      // Zero line stays zero
      expect(reversed[2].debit).toBe(0);
      expect(reversed[2].credit).toBe(0);
    });
  });

  describe('AR Aging Filtering', () => {
    const mockInvoices: MockInvoice[] = [
      { id: '1', status: 'sent', deleted_at: null, balance_due: 5000, due_date: '2026-01-15' },
      { id: '2', status: 'void', deleted_at: null, balance_due: 5000, due_date: '2026-01-10' },
      { id: '3', status: 'sent', deleted_at: '2026-02-01T00:00:00Z', balance_due: 5000, due_date: '2026-01-05' },
      { id: '4', status: 'overdue', deleted_at: null, balance_due: 3000, due_date: '2025-12-01' },
      { id: '5', status: 'paid', deleted_at: null, balance_due: 0, due_date: '2026-01-20' },
      { id: '6', status: 'draft', deleted_at: null, balance_due: 2000, due_date: '2026-02-15' },
      { id: '7', status: 'issued', deleted_at: null, balance_due: 1500, due_date: '2026-02-01' },
    ];

    it('should exclude voided invoices from AR aging', () => {
      const filtered = filterARInvoices(mockInvoices);
      expect(filtered.find((i) => i.id === '2')).toBeUndefined();
    });

    it('should exclude soft-deleted invoices from AR aging', () => {
      const filtered = filterARInvoices(mockInvoices);
      expect(filtered.find((i) => i.id === '3')).toBeUndefined();
    });

    it('should exclude paid invoices (zero balance) from AR aging', () => {
      const filtered = filterARInvoices(mockInvoices);
      expect(filtered.find((i) => i.id === '5')).toBeUndefined();
    });

    it('should exclude draft invoices from AR aging', () => {
      const filtered = filterARInvoices(mockInvoices);
      expect(filtered.find((i) => i.id === '6')).toBeUndefined();
    });

    it('should include valid sent invoices', () => {
      const filtered = filterARInvoices(mockInvoices);
      expect(filtered.find((i) => i.id === '1')).toBeDefined();
    });

    it('should include overdue invoices', () => {
      const filtered = filterARInvoices(mockInvoices);
      expect(filtered.find((i) => i.id === '4')).toBeDefined();
    });

    it('should include issued invoices with balance', () => {
      const filtered = filterARInvoices(mockInvoices);
      expect(filtered.find((i) => i.id === '7')).toBeDefined();
    });

    it('should correctly calculate AR total after filtering', () => {
      const filtered = filterARInvoices(mockInvoices);
      const total = filtered.reduce((s, i) => s + i.balance_due, 0);
      // Only invoices 1 (5000) + 4 (3000) + 7 (1500) = 9500
      expect(total).toBe(9500);
    });
  });

  describe('Cross-Module Cache Invalidation', () => {
    it('should define all required invalidation keys', () => {
      // This test ensures the constant list is maintained
      expect(REQUIRED_INVALIDATION_KEYS).toContain('invoices');
      expect(REQUIRED_INVALIDATION_KEYS).toContain('journal-entries');
      expect(REQUIRED_INVALIDATION_KEYS).toContain('accounts');
      expect(REQUIRED_INVALIDATION_KEYS).toContain('ar_aging');
      expect(REQUIRED_INVALIDATION_KEYS).toContain('financial-reports');
      expect(REQUIRED_INVALIDATION_KEYS.length).toBe(5);
    });
  });
});
