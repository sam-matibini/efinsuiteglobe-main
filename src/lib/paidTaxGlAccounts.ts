/**
 * GL accounts a tax code can debit when tax is paid on a purchase.
 *
 * Recoverable GST/HST is an input tax credit (asset). Non-recoverable PST is
 * an expense on the income statement, so those codes also offer expense accounts.
 */

export interface PaidTaxAccount {
  id: string;
  code: string;
  name: string;
  account_type: string;
  is_header?: boolean;
  posting_allowed?: boolean;
  is_active?: boolean;
}

export interface PaidTaxGlChoices {
  expenses: PaidTaxAccount[];
  assets: PaidTaxAccount[];
}

function isPostable(account: PaidTaxAccount): boolean {
  if (account.is_header) return false;
  if (account.posting_allowed === false) return false;
  if (account.is_active === false) return false;
  return true;
}

function byCode(a: PaidTaxAccount, b: PaidTaxAccount): number {
  return a.code.localeCompare(b.code, undefined, { numeric: true });
}

export function paidTaxGlChoices(
  accounts: PaidTaxAccount[],
  options: { isRecoverable: boolean; selectedId?: string | null },
): PaidTaxGlChoices {
  const ofType = (type: string) =>
    accounts
      .filter((account) => account.account_type === type && isPostable(account))
      .sort(byCode);

  const assets = ofType('asset');
  const expenses = options.isRecoverable ? [] : ofType('expense');
  const listed = new Set([...expenses, ...assets].map((account) => account.id));
  const selectedId = options.selectedId || null;
  const selected = selectedId ? accounts.find((account) => account.id === selectedId) : undefined;

  if (selected && !listed.has(selected.id)) {
    if (selected.account_type === 'asset') assets.unshift(selected);
    else expenses.unshift(selected);
  }

  return { expenses, assets };
}

export function paidTaxGlFieldCopy(isRecoverable: boolean): {
  label: string;
  placeholder: string;
  helper: string;
} {
  if (!isRecoverable) {
    return {
      label: 'GL Paid Account (Expense)',
      placeholder: 'Select expense account',
      helper:
        'Non-recoverable tax such as PST is debited to an expense on the income statement.',
    };
  }
  return {
    label: 'GL Paid / ITC Account (Asset)',
    placeholder: 'Select asset account',
    helper: 'Tax paid on purchases is debited here (e.g. GST/HST ITC).',
  };
}
