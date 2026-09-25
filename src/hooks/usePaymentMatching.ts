/**
 * Payment Matching Hook
 * 
 * Provides utilities to detect and prevent double-posting of credit card payments
 * that appear on both bank statements (as withdrawals) and credit card statements (as payments).
 * 
 * When a bank transaction is categorized as a CC payment, this hook checks if there's
 * already a CC-side journal entry for the same amount and links to it instead of creating a duplicate.
 */

import { supabase } from '@/integrations/supabase/client';

/** Default ±N day window for cross-module duplicate detection. */
export const CC_MATCH_WINDOW_DAYS = 7;

function shiftDate(iso: string, days: number): string {
  const d = new Date(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export interface ExistingCCPaymentJE {
  journalEntryId: string;
  ccTransactionId: string;
  amount: number;
  date: string;
  reference: string;
}

/**
 * Find existing CC payment journal entries for a given CC GL account and amount.
 * Used to detect if a bank CC payment should be linked to an existing CC-side JE
 * instead of creating a new one. Now date-windowed to prevent false matches when
 * multiple payments of the same amount exist.
 */
export async function findExistingCCPaymentJE(
  ccGlAccountId: string,
  amount: number,
  organizationId: string,
  referenceDate?: string,
  windowDays: number = CC_MATCH_WINDOW_DAYS
): Promise<ExistingCCPaymentJE[]> {
  const absAmount = Math.abs(amount);
  
  // Find CC-side payment JEs that debit the CC Payable account
  // CC payments have reference pattern CC-* and debit the CC Payable (reducing liability)
  const { data: jeLines, error } = await supabase
    .from('journal_entry_lines')
    .select(`
      id,
      journal_entry_id,
      debit,
      journal_entry:journal_entries!inner(
        id,
        reference,
        entry_date,
        status,
        organization_id
      )
    `)
    .eq('account_id', ccGlAccountId)
    .gt('debit', 0); // CC payments DEBIT the liability account

  if (error || !jeLines) {
    console.warn('Error finding existing CC payment JEs:', error);
    return [];
  }

  // Filter for exact amount match and CC-prefixed references (from CC module)
  const matches: ExistingCCPaymentJE[] = [];
  
  const minDate = referenceDate ? shiftDate(referenceDate, -windowDays) : null;
  const maxDate = referenceDate ? shiftDate(referenceDate, windowDays) : null;

  for (const line of jeLines) {
    const je = line.journal_entry as any;
    if (!je || je.status !== 'posted' || je.organization_id !== organizationId) continue;

    // Only consider CC module payments (CC-* prefix)
    if (!je.reference?.startsWith('CC-')) continue;

    // Date window check (skipped if no referenceDate provided)
    if (minDate && maxDate) {
      const entryDate = String(je.entry_date).slice(0, 10);
      if (entryDate < minDate || entryDate > maxDate) continue;
    }

    const jeDebit = Number(line.debit) || 0;
    if (Math.abs(jeDebit - absAmount) < 0.01) {
      const { data: linkedBankTx } = await supabase
        .from('bank_transactions')
        .select('id')
        .eq('journal_entry_id', je.id)
        .limit(1);

      if (!linkedBankTx || linkedBankTx.length === 0) {
        const ccTxIdMatch = je.reference.match(/^CC-([A-F0-9-]+)/i);
        const ccTransactionId = ccTxIdMatch ? ccTxIdMatch[1].toLowerCase() : '';

        matches.push({
          journalEntryId: je.id,
          ccTransactionId,
          amount: jeDebit,
          date: je.entry_date,
          reference: je.reference,
        });
      }
    }
  }
  
  return matches;
}

/**
 * Check if a GL account is a credit card payable account
 */
export async function isCreditCardGLAccount(glAccountId: string): Promise<boolean> {
  const { data: cc } = await supabase
    .from('credit_cards')
    .select('id')
    .eq('gl_account_id', glAccountId)
    .limit(1);
  
  return !!(cc && cc.length > 0);
}

/**
 * Find the credit card associated with a GL account
 */
export async function findCreditCardByGLAccount(glAccountId: string): Promise<string | null> {
  const { data } = await supabase
    .from('credit_cards')
    .select('id')
    .eq('gl_account_id', glAccountId)
    .limit(1);
  
  return data?.[0]?.id || null;
}

/**
 * Link a bank transaction to an existing CC payment journal entry
 * instead of creating a new one.
 */
export async function linkBankTransactionToExistingCCPayment(
  bankTransactionId: string,
  existingJournalEntryId: string,
  ccGlAccountId: string
): Promise<void> {
  const { error } = await supabase
    .from('bank_transactions')
    .update({
      journal_entry_id: existingJournalEntryId,
      gl_account_id: ccGlAccountId,
      status: 'matched',
      category: 'Credit Card Payment',
    })
    .eq('id', bankTransactionId);
  
  if (error) {
    throw new Error(`Failed to link bank transaction to CC payment: ${error.message}`);
  }
}

/**
 * Check if a GL account belongs to another bank account in the system.
 * Used to detect inter-account transfers that should not be double-posted.
 */
export async function isBankGLAccount(glAccountId: string): Promise<{ isBankAccount: boolean; bankAccountId?: string; bankAccountName?: string }> {
  const { data } = await supabase
    .from('bank_accounts')
    .select('id, name')
    .eq('gl_account_id', glAccountId)
    .eq('is_active', true)
    .limit(1);
  
  if (data && data.length > 0) {
    return { isBankAccount: true, bankAccountId: data[0].id, bankAccountName: data[0].name };
  }
  return { isBankAccount: false };
}

/**
 * Find existing journal entries from the OTHER bank account's side of an inter-account transfer.
 * When a withdrawal from Bank A targets Bank B's GL account, check if Bank B already has a
 * deposit transaction with a posted JE for the same amount.
 * 
 * @param targetBankAccountId - The bank_accounts.id of the target bank
 * @param amount - The transfer amount (absolute value)
 * @param organizationId - The organization ID
 * @returns Matching JE if found
 */
export async function findExistingBankTransferJE(
  targetBankAccountId: string,
  amount: number,
  organizationId: string,
  referenceDate?: string,
  windowDays: number = CC_MATCH_WINDOW_DAYS
): Promise<{ journalEntryId: string; bankTransactionId: string; reference: string } | null> {
  const absAmount = Math.abs(amount);

  let q = supabase
    .from('bank_transactions')
    .select('id, amount, journal_entry_id, transaction_date, description')
    .eq('bank_account_id', targetBankAccountId)
    .eq('transaction_type', 'deposit')
    .not('journal_entry_id', 'is', null);

  if (referenceDate) {
    q = q.gte('transaction_date', shiftDate(referenceDate, -windowDays))
         .lte('transaction_date', shiftDate(referenceDate, windowDays));
  }

  const { data: matchingDeposits, error } = await q;

  if (error || !matchingDeposits) {
    console.warn('Error finding matching bank transfer:', error);
    return null;
  }

  for (const deposit of matchingDeposits) {
    const depositAmount = Math.abs(Number(deposit.amount));
    if (Math.abs(depositAmount - absAmount) < 0.01 && deposit.journal_entry_id) {
      const { data: je } = await supabase
        .from('journal_entries')
        .select('id, reference, status')
        .eq('id', deposit.journal_entry_id)
        .eq('status', 'posted')
        .eq('organization_id', organizationId)
        .maybeSingle();

      if (je) {
        return {
          journalEntryId: je.id,
          bankTransactionId: deposit.id,
          reference: je.reference,
        };
      }
    }
  }

  return null;
}

export interface ExistingBankPaymentJE {
  journalEntryId: string;
  bankTransactionId: string;
  amount: number;
  date: string;
  reference: string;
}

/**
 * Reverse direction: when posting a CC payment, find an existing bank-side JE
 * that already debited the CC liability (i.e. the bank withdrawal was posted first).
 * Returns ALL matching candidates so the caller can decide whether to auto-link
 * (1 candidate), queue for review (>1), or proceed normally (0).
 */
export async function findBankPaymentJEForCC(
  ccGlAccountId: string,
  amount: number,
  organizationId: string,
  referenceDate?: string,
  windowDays: number = CC_MATCH_WINDOW_DAYS
): Promise<ExistingBankPaymentJE[]> {
  const absAmount = Math.abs(amount);

  // Bank-side JEs that DEBIT the CC liability account
  const { data: jeLines, error } = await supabase
    .from('journal_entry_lines')
    .select(`
      id,
      journal_entry_id,
      debit,
      journal_entry:journal_entries!inner(
        id,
        reference,
        entry_date,
        status,
        organization_id
      )
    `)
    .eq('account_id', ccGlAccountId)
    .gt('debit', 0);

  if (error || !jeLines) {
    console.warn('Error finding existing bank CC-payment JEs:', error);
    return [];
  }

  const minDate = referenceDate ? shiftDate(referenceDate, -windowDays) : null;
  const maxDate = referenceDate ? shiftDate(referenceDate, windowDays) : null;
  const matches: ExistingBankPaymentJE[] = [];

  for (const line of jeLines) {
    const je = line.journal_entry as any;
    if (!je || je.status !== 'posted' || je.organization_id !== organizationId) continue;
    // Only consider BANK-prefixed references (from bank module)
    if (!je.reference?.startsWith('BANK-')) continue;

    if (minDate && maxDate) {
      const entryDate = String(je.entry_date).slice(0, 10);
      if (entryDate < minDate || entryDate > maxDate) continue;
    }

    const jeDebit = Number(line.debit) || 0;
    if (Math.abs(jeDebit - absAmount) >= 0.01) continue;

    // Skip if already linked to a CC tx
    const { data: linkedCcTx } = await supabase
      .from('credit_card_transactions')
      .select('id')
      .eq('journal_entry_id', je.id)
      .limit(1);
    if (linkedCcTx && linkedCcTx.length > 0) continue;

    // Find the bank tx that owns this JE
    const { data: bankTx } = await supabase
      .from('bank_transactions')
      .select('id')
      .eq('journal_entry_id', je.id)
      .limit(1)
      .maybeSingle();

    matches.push({
      journalEntryId: je.id,
      bankTransactionId: bankTx?.id ?? '',
      amount: jeDebit,
      date: je.entry_date,
      reference: je.reference,
    });
  }

  return matches;
}

/**
 * Link a CC transaction to an existing bank-side payment JE (reverse direction).
 * Also marks the bank transaction as a CC Payment for clarity.
 */
export async function linkCCTransactionToExistingBankPayment(
  ccTransactionId: string,
  existingJournalEntryId: string,
  ccGlAccountId: string,
  bankTransactionId?: string
): Promise<void> {
  const { error: ccErr } = await supabase
    .from('credit_card_transactions')
    .update({
      journal_entry_id: existingJournalEntryId,
      gl_account_id: ccGlAccountId,
      status: 'matched',
    })
    .eq('id', ccTransactionId);
  if (ccErr) throw new Error(`Failed to link CC transaction to bank payment: ${ccErr.message}`);

  if (bankTransactionId) {
    await supabase
      .from('bank_transactions')
      .update({ category: 'Credit Card Payment', status: 'matched' })
      .eq('id', bankTransactionId);
  }
}

/**
 * Back-link a CC transaction when the bank side has just been linked to an existing
 * CC-side JE. Keeps both modules in sync (both rows show as matched).
 */
export async function backlinkCCTransactionByJE(journalEntryId: string): Promise<void> {
  await supabase
    .from('credit_card_transactions')
    .update({ status: 'matched' })
    .eq('journal_entry_id', journalEntryId);
}

/**
 * Insert a row into reconciliation_review_queue for ambiguous cross-module matches.
 */
export async function queueAmbiguousMatch(params: {
  organizationId: string;
  reason: 'ambiguous_cc_payment' | 'ambiguous_bank_transfer';
  candidates: Array<Record<string, unknown>>;
  bankTransactionId?: string;
}): Promise<void> {
  const { error } = await supabase.from('reconciliation_review_queue').insert({
    organization_id: params.organizationId,
    reason: params.reason,
    candidates: params.candidates as any,
    status: 'open',
    bank_transaction_id: params.bankTransactionId ?? null,
  });
  if (error) console.warn('Failed to queue ambiguous match:', error);
}

/**
 * Link a bank transaction to an existing inter-account transfer JE
 * instead of creating a duplicate.
 */
export async function linkBankTransactionToExistingTransfer(
  bankTransactionId: string,
  existingJournalEntryId: string,
  glAccountId: string
): Promise<void> {
  const { error } = await supabase
    .from('bank_transactions')
    .update({
      journal_entry_id: existingJournalEntryId,
      gl_account_id: glAccountId,
      status: 'matched',
      category: 'Inter-Account Transfer',
    })
    .eq('id', bankTransactionId);
  
  if (error) {
    throw new Error(`Failed to link bank transaction to transfer: ${error.message}`);
  }
}

/**
 * Find bank transactions that might match a CC payment for cross-module matching
 */
export async function findMatchingBankTransactions(
  bankAccountId: string,
  amount: number,
  _dateWindow?: { start: string; end: string }
): Promise<Array<{
  id: string;
  transaction_date: string;
  description: string;
  amount: number;
  journal_entry_id: string | null;
}>> {
  const absAmount = Math.abs(amount);
  
  const { data, error } = await supabase
    .from('bank_transactions')
    .select('id, transaction_date, description, amount, journal_entry_id')
    .eq('bank_account_id', bankAccountId)
    .eq('transaction_type', 'withdrawal')
    .in('status', ['pending', 'matched']);
  
  if (error || !data) {
    console.warn('Error finding matching bank transactions:', error);
    return [];
  }
  
  // Filter for exact amount match
  return data.filter(tx => {
    const txAmount = Math.abs(Number(tx.amount));
    return Math.abs(txAmount - absAmount) < 0.01;
  });
}
