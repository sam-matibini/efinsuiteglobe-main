/**
 * Which bank or credit card transactions the transaction rules may act on.
 *
 * Rules used to skip every line that already had a category. Plaid fills one in
 * on import ("Transfer", "Food and Drink"), so nearly every downloaded line was
 * skipped. Now a rule considers:
 *  - unmatched: pending or unmatched lines, whatever category the bank gave them;
 *  - not_posted: lines marked matched that have no journal entry yet. A rule only
 *    changes these when it posts to the GL, so a manual categorization is not
 *    overwritten by a rule that only categorizes.
 *
 * Never eligible: reconciled lines, and lines matched to an invoice or a bill
 * (posting those would count the amount twice).
 */

export type RuleScope = 'unmatched' | 'not_posted';

export interface RuleScopeInput {
  status?: string | null;
  journal_entry_id?: string | null;
  matched_invoice_id?: string | null;
  matched_bill_id?: string | null;
}

export interface RuleScopeOptions {
  /**
   * True when processing reverses a line's existing journal entry before posting
   * the new one (bank transactions). Credit card processing does not, so a line
   * that already has a journal entry stays out of scope there.
   */
  replacesExistingPosting?: boolean;
}

export function ruleScopeFor(tx: RuleScopeInput, options: RuleScopeOptions = {}): RuleScope | null {
  const status = tx.status ?? null;
  if (status === 'reconciled') return null;
  if (tx.matched_invoice_id || tx.matched_bill_id) return null;
  const posted = Boolean(tx.journal_entry_id);
  if (status === null || status === 'pending' || status === 'unmatched') {
    if (posted && !options.replacesExistingPosting) return null;
    return 'unmatched';
  }
  if (!posted) return 'not_posted';
  return null;
}

/** A rule applies to a not-yet-posted matched line only when it posts to the GL. */
export function ruleCanActOn(scope: RuleScope, willPostToGL: boolean): boolean {
  return scope === 'unmatched' || willPostToGL;
}

export function countRuleScopes<T extends RuleScopeInput>(transactions: T[], options: RuleScopeOptions = {}) {
  let unmatched = 0;
  let notPosted = 0;
  for (const tx of transactions) {
    const scope = ruleScopeFor(tx, options);
    if (scope === 'unmatched') unmatched += 1;
    else if (scope === 'not_posted') notPosted += 1;
  }
  return { unmatched, notPosted, total: unmatched + notPosted };
}

interface RuleActionLike {
  type: string;
  category?: string;
  glAccountId?: string;
  glAccountName?: string;
}

/**
 * The GL account a rule assigns. "Analyze & Categorize" stores the account on the
 * categorize action, and "Post to General Ledger" on the post action. Both are read,
 * so a categorize-only rule still sets the line's GL account.
 */
export function ruleGlTarget(actions: RuleActionLike[]) {
  const categorize = actions.find((a) => a.type === 'categorize');
  const post = actions.find((a) => a.type === 'post_to_gl');
  const glAccountId = post?.glAccountId || categorize?.glAccountId || null;
  const glAccountName = post?.glAccountName || categorize?.glAccountName || null;
  return {
    category: categorize?.category || null,
    glAccountId,
    glAccountName,
    willPostToGL: Boolean(post) && Boolean(glAccountId),
  };
}
