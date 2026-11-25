/**
 * Balance Sheet equity built from the same journal lines as every other line
 * on the report, so the statement balances whenever the ledger does.
 *
 * Double entry guarantees Σ(debits) = Σ(credits) over all accounts. Writing
 * every account balance credit-positive, that means
 *
 *   Assets − Liabilities − Other equity − [RE group + all P&L accounts] = 0
 *
 * where the "RE group" is Retained Earnings, the Current Year Earnings bucket
 * and dividend/drawing accounts. Retained Earnings at the report date is
 * therefore exactly the cumulative credit-positive balance of the RE group
 * plus every income/expense account. No database formula is involved, so
 * there is nothing that can drift from the Trial Balance.
 *
 * The rollforward splits that closing figure into the familiar lines:
 *   Opening RE        everything dated before the fiscal-year start
 *   Net income        P&L activity in the fiscal year, excluding the closing
 *                     entry that moves it into Retained Earnings
 *   Dividends         dividend/drawing movement in the fiscal year
 *   Other +/-         whatever else moved Retained Earnings (adjustments)
 *   Closing RE        opening + net income − dividends + other
 */

export interface EquityClassifiable {
  code?: string | null;
  name?: string | null;
  account_type?: string | null;
  normal_balance?: string | null;
}

export const isCurrentYearEarningsEquityAccount = (account: EquityClassifiable): boolean => {
  const nameLower = account.name?.toLowerCase() || '';
  return (
    account.code === '3-00-202' ||
    nameLower.includes('current year earnings') ||
    nameLower.includes('current year earning') ||
    nameLower.includes('current earnings') ||
    nameLower === 'current year net income' ||
    nameLower === 'current year income' ||
    nameLower.includes('current year excess') ||
    nameLower.includes('current year surplus') ||
    nameLower.includes('excess (deficiency)')
  );
};

export const isRetainedEarningsEquityAccount = (account: EquityClassifiable): boolean => {
  const nameLower = account.name?.toLowerCase() || '';
  return (
    account.code === '3-00-201' ||
    nameLower === 'retained earnings' ||
    nameLower === 'retained profits' ||
    nameLower.includes('retained earnings') ||
    nameLower.includes('accumulated deficit') ||
    nameLower.includes('accumulated earnings') ||
    nameLower.includes('unrestricted net assets') ||
    nameLower.includes('accumulated surplus') ||
    nameLower.includes('unrestricted funds') ||
    nameLower.includes('accumulated funds')
  );
};

export const isDividendOrContraEquityAccount = (account: EquityClassifiable): boolean => {
  const nameLower = account.name?.toLowerCase() || '';
  return (
    (account.account_type === 'equity' && account.normal_balance === 'debit') ||
    nameLower.includes('dividend') ||
    nameLower.includes("owner's draw") ||
    nameLower.includes('owner draw') ||
    nameLower.includes('owners draw') ||
    nameLower.includes('shareholder draw') ||
    nameLower.includes('drawing') ||
    nameLower.includes('distribution') ||
    nameLower.includes('treasury stock') ||
    nameLower.includes('treasury shares')
  );
};

/** Equity accounts whose balance is presented through the Retained Earnings rollforward. */
export const isExcludedFromEquityTotal = (account: EquityClassifiable): boolean =>
  isCurrentYearEarningsEquityAccount(account) ||
  isRetainedEarningsEquityAccount(account) ||
  isDividendOrContraEquityAccount(account);

export const isPermanentAccountType = (type?: string | null): boolean =>
  ['asset', 'liability', 'equity'].includes(String(type ?? ''));

/** Per-account ledger figures, normalized to the account's normal balance. */
export interface LedgerBuckets {
  /** Opening balance (permanent accounts) + every line up to the report date. */
  bs_cumulative: number;
  /** The same, restricted to lines before the report's fiscal-year start. */
  bs_before_fy: number;
  /** Lines of closing (CLOSE-*) entries dated inside the report's fiscal year. */
  bs_fy_close: number;
}

export interface BucketLine {
  journal_entry_id: string;
  debitCents: number;
  creditCents: number;
}

/**
 * Accumulates an account's lines into LedgerBuckets (returned in currency units).
 * `entryDate` maps entry id → YYYY-MM-DD; `closingEntryIds` are CLOSE-* entries.
 */
export function computeLedgerBuckets(args: {
  normalBalance: string;
  accountType: string;
  openingBalanceCents: number;
  lines: BucketLine[];
  entryDate: Map<string, string>;
  closingEntryIds: Set<string>;
  fiscalYearStart: string;
  endDate: string;
}): LedgerBuckets {
  const sign = args.normalBalance === 'debit' ? 1 : -1;
  const opening = isPermanentAccountType(args.accountType) ? args.openingBalanceCents : 0;
  let cumulative = opening;
  let beforeFy = opening;
  let fyClose = 0;
  for (const line of args.lines) {
    const date = args.entryDate.get(line.journal_entry_id);
    if (!date || date > args.endDate) continue;
    const amt = sign * (line.debitCents - line.creditCents);
    cumulative += amt;
    if (date < args.fiscalYearStart) beforeFy += amt;
    else if (args.closingEntryIds.has(line.journal_entry_id)) fyClose += amt;
  }
  return { bs_cumulative: cumulative / 100, bs_before_fy: beforeFy / 100, bs_fy_close: fyClose / 100 };
}

export interface RetainedEarningsRollforward {
  openingBalance: number;
  netIncomeLoss: number;
  otherAdditions: number;
  dividendsDeclared: number;
  otherDeductions: number;
  closingBalance: number;
}

export interface RollforwardAccount extends EquityClassifiable, Partial<LedgerBuckets> {
  is_header?: boolean | null;
}

const cents = (n: number | undefined | null) => Math.round((Number(n) || 0) * 100);

export function buildRetainedEarningsRollforward(accounts: RollforwardAccount[]): RetainedEarningsRollforward {
  let opening = 0;
  let closing = 0;
  let netIncome = 0;
  let dividends = 0;
  for (const a of accounts) {
    // Header accounts carry no postings of their own (the Trial Balance skips them too).
    if (a.is_header) continue;
    const isTemp = !isPermanentAccountType(a.account_type);
    const isReGroup = a.account_type === 'equity' && isExcludedFromEquityTotal(a);
    if (!isTemp && !isReGroup) continue;
    // Credit-positive: income and RE add, expenses and dividends subtract.
    const s = a.normal_balance === 'credit' ? 1 : -1;
    const cum = cents(a.bs_cumulative);
    const before = cents(a.bs_before_fy);
    const close = cents(a.bs_fy_close);
    opening += s * before;
    closing += s * cum;
    const movement = s * (cum - before - close);
    if (isTemp) netIncome += movement;
    else if (isDividendOrContraEquityAccount(a)) dividends -= movement;
  }
  // Everything else that moved RE this year (adjustments, the closing entry's
  // residual) — derived so the rollforward always lands on the closing balance.
  const other = closing - opening - netIncome + dividends;
  return {
    openingBalance: opening / 100,
    netIncomeLoss: netIncome / 100,
    dividendsDeclared: dividends / 100,
    otherAdditions: Math.max(other, 0) / 100,
    otherDeductions: Math.max(-other, 0) / 100,
    closingBalance: closing / 100,
  };
}
