/**
 * Shared helpers to keep the General Ledger and downstream financial reports
 * in sync when bank / credit-card / rule-based categorizations change.
 *
 * Two responsibilities:
 *  1. reverseLinkedJournalEntry — when a transaction is being re-categorized,
 *     reverse the previously-posted JE (audit-safe: status='reversed' + REV-* entry).
 *  2. recalculateAndInvalidate — call recalculate_all_account_balances and invalidate
 *     every report query so Income Statement / Balance Sheet / Trial Balance / etc.
 *     refresh without a manual reload.
 */
import { supabase } from '@/integrations/supabase/client';
import type { QueryClient } from '@tanstack/react-query';

const REPORT_QUERY_KEYS: string[][] = [
  ['income-statement'],
  ['balance-sheet'],
  ['trial-balance'],
  ['general-ledger'],
  ['comparative-financial-reports'],
  ['comparative-income-statement'],
  ['comparative-balance-sheet'],
  ['cash-flow'],
  ['account-balances'],
  ['financial-reports'],
  ['accounts'],
  ['journal-entries'],
];

/**
 * Reverse a posted journal entry (creates REV-* entry with debit/credit swapped,
 * marks the original as reversed) and unlink it from the source bank transaction.
 * Safe to call even if no JE is linked.
 */
export async function reverseLinkedJournalEntry(params: {
  bankTransactionId?: string;
  creditCardTransactionId?: string;
  journalEntryId: string | null | undefined;
  organizationId: string;
}): Promise<void> {
  const { journalEntryId, bankTransactionId, creditCardTransactionId } = params;
  if (!journalEntryId) return;

  // Load the source JE
  const { data: je, error: jeErr } = await supabase
    .from('journal_entries')
    .select(
      `id, organization_id, reference, status, journal_entry_lines (account_id, description, debit, credit, line_order)`
    )
    .eq('id', journalEntryId)
    .maybeSingle();

  if (jeErr || !je) return; // already gone — nothing to reverse
  // If not posted (already reversed/draft), just unlink
  if (je.status !== 'posted') {
    await unlinkJE(bankTransactionId, creditCardTransactionId);
    return;
  }

  const lines = (je.journal_entry_lines || []) as Array<{
    account_id: string;
    description: string | null;
    debit: number | string;
    credit: number | string;
    line_order: number | null;
  }>;

  // Create reversing entry
  const { data: rev, error: revErr } = await supabase
    .from('journal_entries')
    .insert({
      organization_id: je.organization_id,
      reference: `REV-${je.reference}`,
      entry_date: new Date().toISOString().split('T')[0],
      description: `Reversal of ${je.reference} (re-categorization)`,
      notes: 'Auto-reversal triggered by transaction re-categorization',
      status: 'posted',
      posted_at: new Date().toISOString(),
      reversal_of: je.id,
    })
    .select('id')
    .single();

  if (revErr) throw revErr;

  if (lines.length > 0) {
    const reversedLines = lines.map((l, i) => ({
      journal_entry_id: rev.id,
      account_id: l.account_id,
      description: l.description,
      debit: Number(l.credit) || 0,
      credit: Number(l.debit) || 0,
      line_order: l.line_order ?? i,
    }));
    const { error: linesErr } = await supabase
      .from('journal_entry_lines')
      .insert(reversedLines);
    if (linesErr) throw linesErr;
  }

  // Mark original reversed
  await supabase
    .from('journal_entries')
    .update({ status: 'reversed', reversed_at: new Date().toISOString() })
    .eq('id', je.id);

  await unlinkJE(bankTransactionId, creditCardTransactionId);
}

async function unlinkJE(bankTransactionId?: string, creditCardTransactionId?: string) {
  if (bankTransactionId) {
    await supabase
      .from('bank_transactions')
      .update({ journal_entry_id: null })
      .eq('id', bankTransactionId);
  }
  if (creditCardTransactionId) {
    await supabase
      .from('credit_card_transactions')
      .update({ journal_entry_id: null })
      .eq('id', creditCardTransactionId);
  }
}

/**
 * Recalculate all account balances for the org and invalidate every report
 * query so financial statements refresh immediately.
 */
export async function recalculateAndInvalidate(
  organizationId: string | null | undefined,
  queryClient: QueryClient
): Promise<void> {
  if (organizationId) {
    const { error } = await supabase.rpc('recalculate_all_account_balances', {
      p_organization_id: organizationId,
    });
    if (error) console.warn('recalculate_all_account_balances warning:', error);
  }
  for (const key of REPORT_QUERY_KEYS) {
    queryClient.invalidateQueries({ queryKey: key });
  }
}

export const REPORT_QUERY_KEYS_LIST = REPORT_QUERY_KEYS;
