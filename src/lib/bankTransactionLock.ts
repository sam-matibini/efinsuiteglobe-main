/**
 * A downloaded bank line is often marked cleared because the bank has posted
 * it. That is not a reconciliation. Keep it editable until it is categorized
 * to a GL account, posted, or explicitly reconciled.
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
  if (tx.status === 'reconciled') return true;
  if (!tx.is_cleared) return false;
  return Boolean(tx.journal_entry_id || tx.gl_account_id);
}
