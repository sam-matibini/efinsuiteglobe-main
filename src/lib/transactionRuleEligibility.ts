/**
 * Lines a banking rule may categorize or post.
 * A category on an unmatched row does not keep it out. A line already posted
 * to the ledger, or marked reconciled, stays out.
 */
export function isOpenForTransactionRule(transaction: {
  status?: string | null;
  journal_entry_id?: string | null;
}): boolean {
  if (transaction.journal_entry_id) return false;
  return String(transaction.status ?? '').toLowerCase() !== 'reconciled';
}
