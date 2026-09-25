import { supabase } from '@/integrations/supabase/client';
import {
  createJournalEntry,
  getDefaultAccounts,
  getTaxGlAccounts,
  type JournalEntryLine,
} from '@/hooks/useJournalEntryCreation';
import {
  resolveRetailTaxGlAccount,
  splitPurchaseTaxPosting,
  type DocumentTaxLine,
} from '@/lib/documentTaxEngine';

export interface BillGLLine {
  /** Chart of Accounts expense/COGS/asset account chosen for the line. */
  account_id?: string | null;
  /** Net (pre-tax) amount of the line. */
  amount: number;
  description?: string | null;
  department_id?: string | null;
}

export interface PostBillToGLParams {
  organizationId: string;
  billId: string;
  billNumber: string;
  billDate: string;
  vendorId: string;
  taxAmount: number;
  total: number;
  departmentId?: string | null;
  lines: BillGLLine[];
  /** Split retail taxes paid (GST/HST ITC, Input VAT, PST paid). */
  taxLines?: DocumentTaxLine[];
}

/**
 * Posts a bill to the General Ledger:
 *   DR each line's expense account (net amount + non-recoverable tax)
 *   DR input tax / ITC account(s) (recoverable GST/HST/VAT)
 *      CR Accounts Payable (bill total)
 *
 * Throws when the required accounts cannot be resolved so the caller can roll
 * the bill back instead of leaving an un-posted document behind.
 * Returns the created journal entry id.
 */
export async function postBillToGL(params: PostBillToGLParams): Promise<string> {
  const {
    organizationId,
    billId,
    billNumber,
    billDate,
    vendorId,
    taxAmount,
    total,
    departmentId,
    lines,
    taxLines,
  } = params;

  const [defaultAccounts, taxGl] = await Promise.all([
    getDefaultAccounts(organizationId),
    getTaxGlAccounts(organizationId),
  ]);

  if (!defaultAccounts.ap) {
    throw new Error(
      'No Accounts Payable account found. Set up Accounts Payable in Settings → Chart of Accounts before creating bills.',
    );
  }

  // Fall back to a general expense account only for lines with no explicit account.
  let fallbackAccountId: string | null = null;
  const needsFallback = lines.some((l) => !l.account_id);
  if (needsFallback) {
    const { data: expenseAccount } = await supabase
      .from('accounts')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('account_type', 'expense')
      .eq('is_active', true)
      .eq('is_header', false)
      .order('code', { ascending: true })
      .limit(1)
      .maybeSingle();
    fallbackAccountId = expenseAccount?.id ?? null;
    if (!fallbackAccountId) {
      throw new Error(
        'No expense account found for this bill. Select an account on each line or add an expense account to the Chart of Accounts.',
      );
    }
  }

  const baseDimensions = {
    vendor_id: vendorId,
    source_document_type: 'bill',
    source_document_id: billId,
  };

  const journalLines: JournalEntryLine[] = [];

  // Merge lines that share the same account to keep the entry compact.
  const byAccount = new Map<string, number>();
  for (const line of lines) {
    const accountId = line.account_id || fallbackAccountId!;
    const amount = Number(line.amount) || 0;
    if (amount === 0) continue;
    byAccount.set(accountId, (byAccount.get(accountId) || 0) + amount);
  }

  const split = taxLines?.length ? splitPurchaseTaxPosting(taxLines) : null;
  const nonRecoverable = split?.nonRecoverableTotal ?? 0;
  if (nonRecoverable > 0) {
    const firstExpenseId = [...byAccount.keys()][0] || fallbackAccountId;
    if (!firstExpenseId) {
      throw new Error('No expense account found to post non-recoverable sales tax paid.');
    }
    byAccount.set(firstExpenseId, (byAccount.get(firstExpenseId) || 0) + nonRecoverable);
  }

  for (const [accountId, amount] of byAccount) {
    journalLines.push({
      account_id: accountId,
      debit: amount,
      credit: 0,
      memo: `Bill ${billNumber}`,
      department_id: departmentId || undefined,
      ...baseDimensions,
    });
  }

  if (journalLines.length === 0) {
    throw new Error('Bill has no amounts to post to the General Ledger.');
  }

  const tax = Number(taxAmount) || 0;
  if (split && split.recoverable.length > 0) {
    const byTaxAccount = new Map<string, { amount: number; name: string }>();
    for (const line of split.recoverable) {
      const accountId =
        line.glAccountId ||
        resolveRetailTaxGlAccount(line.taxCode || line.taxType, 'paid', {
          gstPaidAccountId: taxGl.gstPaidAccountId,
          vatPaidAccountId: taxGl.vatPaidAccountId,
          pstPaidAccountId: taxGl.pstPaidAccountId,
        });
      if (!accountId) {
        throw new Error(
          `No paid/ITC account configured for ${line.taxName}. Set the tax paid GL account in Settings → Sales Tax.`,
        );
      }
      const existing = byTaxAccount.get(accountId);
      byTaxAccount.set(accountId, {
        amount: (existing?.amount || 0) + line.taxAmount,
        name: line.taxName,
      });
    }
    for (const [accountId, info] of byTaxAccount) {
      journalLines.push({
        account_id: accountId,
        debit: info.amount,
        credit: 0,
        memo: `${info.name} - Bill ${billNumber}`,
        department_id: departmentId || undefined,
        ...baseDimensions,
      });
    }
  } else if (tax > 0 && !split) {
    const itcAccountId = taxGl.gstPaidAccountId || taxGl.vatPaidAccountId;
    if (!itcAccountId) {
      throw new Error(
        'No input tax (ITC) account configured. Set the tax paid GL account in Settings → Sales Tax before posting a bill with tax.',
      );
    }
    journalLines.push({
      account_id: itcAccountId,
      debit: tax,
      credit: 0,
      memo: `Input tax - Bill ${billNumber}`,
      department_id: departmentId || undefined,
      ...baseDimensions,
    });
  } else if (tax > 0 && split && split.recoverableTotal === 0 && split.nonRecoverableTotal === 0) {
    // Tax amount present but no split rows — treat as recoverable ITC.
    const itcAccountId = taxGl.gstPaidAccountId || taxGl.vatPaidAccountId;
    if (itcAccountId) {
      journalLines.push({
        account_id: itcAccountId,
        debit: tax,
        credit: 0,
        memo: `Input tax - Bill ${billNumber}`,
        department_id: departmentId || undefined,
        ...baseDimensions,
      });
    }
  }

  journalLines.push({
    account_id: defaultAccounts.ap.id,
    debit: 0,
    credit: Number(total) || 0,
    memo: `Bill ${billNumber}`,
    department_id: departmentId || undefined,
    ...baseDimensions,
  });

  const journalEntryId = await createJournalEntry({
    organizationId,
    date: billDate,
    description: `Bill ${billNumber} from vendor`,
    reference: `BILL-${billNumber}`,
    journalType: 'purchase',
    departmentId: departmentId || null,
    lines: journalLines,
  });

  await supabase.from('bills').update({ journal_entry_id: journalEntryId }).eq('id', billId);

  return journalEntryId;
}
