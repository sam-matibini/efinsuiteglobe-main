/**
 * Lines the transaction-rule engine may analyze, categorize, and post.
 *
 * A downloaded line is often already tagged with a feed category such as
 * "Transfer" while its status is still unmatched and nothing has been posted.
 * That feed label is not an accounting category, so it must not keep the line
 * out of the rules.
 */
export function isEligibleForTransactionRules(tx: {
  status?: string | null;
  journal_entry_id?: string | null;
  matched_invoice_id?: string | null;
  matched_bill_id?: string | null;
}): boolean {
  if (tx.journal_entry_id) return false;
  if (tx.matched_invoice_id || tx.matched_bill_id) return false;
  const status = (tx.status ?? '').trim().toLowerCase();
  if (status === 'reconciled' || status === 'matched' || status === 'excluded') return false;
  return status === 'unmatched' || status === 'pending' || status === '';
}
