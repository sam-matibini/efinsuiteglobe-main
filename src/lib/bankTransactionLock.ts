/**
 * A downloaded line is often marked cleared because the bank has posted it,
 * and a transaction rule may already have posted it to the ledger. Neither
 * of those is a reconciliation. The line stays editable so it can be
 * re-categorized and posted to another GL account. Only an explicit
 * reconciliation locks it.
 */

const PLACEHOLDER_CATEGORIES = new Set(['', 'uncategorized', 'unclassified']);

export function hasAccountingCategory(category: string | null | undefined): boolean {
  const value = category?.trim().toLowerCase() ?? '';
  return value.length > 0 && !PLACEHOLDER_CATEGORIES.has(value);
}

export function isBankTransactionLocked(tx: {
  status?: string | null;
  is_cleared?: boolean | null;
  category?: string | null;
  gl_account_id?: string | null;
  journal_entry_id?: string | null;
}): boolean {
  return tx.status === 'reconciled';
}

/**
 * The database trigger treats is_cleared as reconciled and rejects every
 * other change. A downloaded line can be cleared because the bank posted it.
 * Clearing that flag in the same update lets categorization through, and it
 * leaves a real reconciliation (status reconciled) locked.
 */
export function allowUnreconciledBankUpdate<T extends Record<string, unknown>>(
  updates: T,
  row: { status?: string | null; is_cleared?: boolean | null } | null | undefined,
): T {
  if (!row || row.status === 'reconciled' || row.is_cleared !== true) return updates;
  if ('is_cleared' in updates) return updates;
  return { ...updates, is_cleared: false, cleared_at: null };
}
