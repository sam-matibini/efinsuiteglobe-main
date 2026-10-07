import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { createJournalEntry } from './useJournalEntryCreation';
import { allowUnreconciledBankUpdate } from '@/lib/bankTransactionLock';
import { applyGlEditToJournalLines } from '@/lib/postedJournalEdit';
import { TaxCode } from './useSalesTax';
import { ensurePersistedTaxCode } from '@/lib/persistTaxCode';
import { toast } from 'sonner';
import { JournalEntryLineDimensions } from './useJournalEntryCreation';
import {
  findBankPaymentJEForCC,
  linkCCTransactionToExistingBankPayment,
  queueAmbiguousMatch,
} from './usePaymentMatching';
import {
  creditCardRefundJournal,
  isExpenseLikeAccount,
  planBankTaxLines,
} from '@/lib/expenseRefundPosting';

export interface TaxBreakdownItem {
  code: string;
  rate: number;
  amount: number;
  glAccountId: string | null;
}

export interface PostCreditCardTransactionToGLParams {
  transactionId: string;
  creditCardId: string;
  glAccountId: string;
  organizationId: string;
  amount: number;
  transactionType: 'charge' | 'payment' | 'credit' | 'fee' | 'interest';
  description: string;
  transactionDate: string;
  category?: string;
  payeePayor?: string;
  reference?: string;
  taxCode?: TaxCode;
  taxAmount?: number;
  // Split tax breakdown for GST+PST provinces
  taxBreakdown?: TaxBreakdownItem[];
  // Dimension support
  dimensions?: JournalEntryLineDimensions;
}

/**
 * Hook for posting credit card transactions to the General Ledger
 * Creates proper double-entry journal entries
 * 
 * Credit Card Accounting Logic:
 * - CHARGES (purchases, fees, interest): DEBIT Expense Account, CREDIT Credit Card Liability
 * - PAYMENTS: DEBIT Credit Card Liability, CREDIT Bank/Cash Account
 * - CREDITS (refunds): DEBIT Credit Card Liability, CREDIT Expense Account
 */
export function usePostCreditCardTransactionToGL() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: PostCreditCardTransactionToGLParams) => {
      const {
        transactionId,
        creditCardId,
        glAccountId,
        organizationId,
        amount,
        transactionType,
        description,
        transactionDate,
        category,
        payeePayor,
        reference,
        taxCode,
        taxAmount,
        taxBreakdown,
        dimensions,
      } = params;

      // Get the credit card's linked GL account (the liability account)
      const { data: creditCard, error: ccError } = await supabase
        .from('credit_cards')
        .select('gl_account_id, name, organization_id')
        .eq('id', creditCardId)
        .single();

      if (ccError) {
        console.error('Credit card fetch error:', ccError);
        throw new Error(`Failed to fetch credit card: ${ccError.message}`);
      }

      if (!creditCard) {
        throw new Error('Credit card not found. Please refresh and try again.');
      }

      if (!creditCard.gl_account_id) {
        throw new Error(`"${creditCard.name}" is not linked to a GL account. Please go to Banking → Credit Cards and update the card settings.`);
      }

      // Validate organization ID matches
      if (creditCard.organization_id !== organizationId) {
        throw new Error('Credit card belongs to a different organization.');
      }

      // Idempotency: if this transaction is already linked to a journal entry, don't create another
      const { data: existingTx, error: existingTxError } = await supabase
        .from('credit_card_transactions')
        .select('journal_entry_id, status, is_cleared')
        .eq('id', transactionId)
        .maybeSingle();

      if (existingTxError) {
        console.error('Existing transaction lookup error:', existingTxError);
        throw new Error(`Failed to validate transaction state: ${existingTxError.message}`);
      }

      if (existingTx?.status === 'reconciled') {
        throw new Error('This transaction is reconciled. Unreconcile it before posting.');
      }

      if (existingTx?.journal_entry_id && creditCard.gl_account_id) {
        const { data: jeLines, error: lineErr } = await supabase
          .from('journal_entry_lines')
          .select('id, account_id, debit, credit')
          .eq('journal_entry_id', existingTx.journal_entry_id);
        if (lineErr) throw new Error(lineErr.message);
        const rewritten = applyGlEditToJournalLines(
          jeLines || [],
          creditCard.gl_account_id,
          null,
          glAccountId,
          Math.abs(amount),
        );
        for (const line of rewritten) {
          const { error: lineUpdateErr } = await supabase
            .from('journal_entry_lines')
            .update({ account_id: line.account_id, debit: line.debit, credit: line.credit })
            .eq('id', line.id);
          if (lineUpdateErr) throw new Error(lineUpdateErr.message);
        }
        const { error: keepErr } = await supabase
          .from('credit_card_transactions')
          .update(allowUnreconciledBankUpdate({
            journal_entry_id: existingTx.journal_entry_id,
            gl_account_id: glAccountId,
            status: 'matched',
          }, existingTx))
          .eq('id', transactionId);
        if (keepErr) throw new Error(keepErr.message);
        return { journalEntryId: existingTx.journal_entry_id, transactionId };
      }

      // Calculate amounts for journal entries
      // CRITICAL: The CC Loan liability must be credited for the FULL transaction amount
      // (gross, including tax) since that's what is actually owed on the card.
      // The expense account gets the net amount, and tax accounts get the tax portion.
      const grossAmount = Math.abs(amount); // Full amount including any tax
      
      const { data: chart, error: chartError } = await supabase
        .from('accounts')
        .select('id, name, account_type, is_header, posting_allowed, parent_id')
        .eq('organization_id', organizationId)
        .eq('is_active', true);
      if (chartError) throw new Error(`Failed to load accounts: ${chartError.message}`);
      const chartAccounts = chart || [];
      const offsetAccount = chartAccounts.find((account) => account.id === glAccountId) ?? null;
      const incomingTax = (taxBreakdown && taxBreakdown.length > 0)
        ? taxBreakdown.map((item) => ({ ...item, amount: Math.abs(item.amount) }))
        : (taxCode && taxAmount && Math.abs(taxAmount) > 0)
          ? [{
              code: taxCode.code,
              rate: Number(taxCode.rate) || 0,
              amount: Math.abs(taxAmount),
              glAccountId: taxCode.gl_paid_account_id || taxCode.gl_collected_account_id,
            }]
          : [];
      const expenseRefund = transactionType === 'credit' && isExpenseLikeAccount(offsetAccount);
      const plannedTax = planBankTaxLines({
        transactionType: expenseRefund ? 'deposit' : 'withdrawal',
        offsetAccounts: expenseRefund ? [offsetAccount] : [{ account_type: 'expense' }],
        taxBreakdown: incomingTax,
        taxCode,
        accounts: chartAccounts,
      });
      const postsTax = transactionType === 'charge' || transactionType === 'fee' || transactionType === 'interest' || expenseRefund;
      if (plannedTax.error && postsTax) throw new Error(plannedTax.error);
      const taxToPost = plannedTax.lines
        .filter((item) => item.glAccountId && item.amount > 0)
        .map((item) => ({
          code: item.code,
          amount: item.amount,
          glAccountId: item.glAccountId as string,
        }));

      const payeeInfo = payeePayor ? ` - ${payeePayor}` : '';
      const baseDimensions = {
        ...dimensions,
        source_document_type: 'credit_card_transaction',
        source_document_id: transactionId,
      };
      const lines: Array<{ account_id: string; debit: number; credit: number; memo: string } & typeof baseDimensions> = [];

      // Transaction type determines the journal entry structure
      // Credit Card Liability is a CREDIT-normal account (increases with credit)
      if (transactionType === 'charge' || transactionType === 'fee' || transactionType === 'interest') {
        // CHARGE: Expense increases (debit), Tax accounts (debit), CC Liability increases (credit)
        
        // Calculate net expense amount (gross minus any posted taxes)
        const postedTaxTotal = taxToPost.reduce((sum, t) => sum + t.amount, 0);
        const expenseAmount = grossAmount - postedTaxTotal;
        
        // Debit Expense Account for net amount (excluding tax)
        lines.push({
          account_id: glAccountId,
          debit: expenseAmount,
          credit: 0,
          memo: category || description,
          ...baseDimensions,
        });
        
        // Debit Tax Paid/Recoverable accounts
        for (const taxItem of taxToPost) {
          lines.push({
            account_id: taxItem.glAccountId,
            debit: taxItem.amount,
            credit: 0,
            memo: `${taxItem.code} paid on ${description}`,
            ...baseDimensions,
          });
        }
        
        // Credit Credit Card Liability for GROSS amount (what you actually owe)
        lines.push({
          account_id: creditCard.gl_account_id,
          debit: 0,
          credit: grossAmount,
          memo: `CC Charge${payeeInfo}: ${description}`,
          ...baseDimensions,
        });
      } else if (transactionType === 'payment') {
        // First post only: link to the bank withdrawal when one already exists.
        // A re-post keeps the account selected in the form.
        const bankCandidates = await findBankPaymentJEForCC(
          creditCard.gl_account_id,
          grossAmount,
          organizationId,
          transactionDate
        );
        if (bankCandidates.length === 1) {
          const m = bankCandidates[0];
          await linkCCTransactionToExistingBankPayment(
            transactionId,
            m.journalEntryId,
            glAccountId,
            m.bankTransactionId
          );
          return { journalEntryId: m.journalEntryId, transactionId, linkedToExisting: true };
        }
        if (bankCandidates.length > 1) {
          await queueAmbiguousMatch({
            organizationId,
            reason: 'ambiguous_cc_payment',
            candidates: bankCandidates.map(c => ({
              id: c.journalEntryId, date: c.date, amount: c.amount,
              description: c.reference, reference: c.reference,
            })),
          });
          throw new Error(`Multiple bank withdrawals match this CC payment within ±7 days. Sent to Reconciliation Review.`);
        }

        // PAYMENT: Credit Card Liability decreases (debit), Bank/Cash decreases (credit)
        lines.push({
          account_id: creditCard.gl_account_id,
          debit: grossAmount,
          credit: 0,
          memo: `CC Payment${payeeInfo}: ${description}`,
          ...baseDimensions,
        });
        lines.push({
          account_id: glAccountId,
          debit: 0,
          credit: grossAmount,
          memo: `Payment to ${creditCard.name}`,
          ...baseDimensions,
        });
      } else if (transactionType === 'credit') {
        if (expenseRefund && taxToPost.length > 0) {
          const refundLines = creditCardRefundJournal({
            liabilityAccountId: creditCard.gl_account_id,
            offsetAccountId: glAccountId,
            grossAmount,
            taxLines: plannedTax.lines,
            description,
            payee: payeePayor,
          });
          for (const line of refundLines) {
            lines.push({ ...line, ...baseDimensions });
          }
        } else {
          // CREDIT/REFUND: Credit Card Liability decreases (debit), Expense decreases (credit)
          lines.push({
            account_id: creditCard.gl_account_id,
            debit: grossAmount,
            credit: 0,
            memo: `CC Credit${payeeInfo}: ${description}`,
            ...baseDimensions,
          });
          lines.push({
            account_id: glAccountId,
            debit: 0,
            credit: grossAmount,
            memo: `Refund - ${description}`,
            ...baseDimensions,
          });
        }
      }

      // Create the journal entry
      let journalEntryId: string;
      const typeLabel = 
        transactionType === 'charge' ? 'Charge' :
        transactionType === 'payment' ? 'Payment' :
        transactionType === 'credit' ? 'Credit' :
        transactionType === 'fee' ? 'Fee' : 'Interest';

      const journalReference = `CC-${transactionId.slice(0, 8).toUpperCase()}`;
      const ccRefInfo = reference ? ` (Ref: ${reference})` : '';

      try {
        journalEntryId = await createJournalEntry({
          organizationId,
          date: transactionDate,
          description: `CC ${typeLabel}${payeeInfo}: ${description}${ccRefInfo}`,
          reference: journalReference,
          lines,
          status: 'posted',
          departmentId: dimensions?.department_id ?? null,
        });
      } catch (jeError: unknown) {
        // If we hit a duplicate-reference race, reuse the existing journal entry
        const anyErr = jeError as any;
        const errCode = anyErr?.code;
        const errMsg = anyErr?.message || (jeError instanceof Error ? jeError.message : String(jeError));

        if (errCode === '23505') {
          const { data: existingJe, error: existingJeError } = await supabase
            .from('journal_entries')
            .select('id')
            .eq('organization_id', organizationId)
            .eq('reference', journalReference)
            .maybeSingle();

          if (!existingJeError && existingJe?.id) {
            journalEntryId = existingJe.id;
          } else {
            console.error('Duplicate reference but failed to fetch existing journal entry:', existingJeError);
            throw new Error(`Failed to create journal entry: ${errMsg}`);
          }
        } else {
          console.error('Journal entry creation failed:', jeError);
          throw new Error(`Failed to create journal entry: ${errMsg}`);
        }
      }

      // Update credit card transaction with the journal entry ID + persist tax data for audit
      const postedTaxTotal = taxToPost.reduce((sum, t) => sum + t.amount, 0);
      const ccTxUpdate: Record<string, unknown> = {
        journal_entry_id: journalEntryId,
        gl_account_id: glAccountId,
        status: 'matched',
      };
      if (dimensions?.department_id) ccTxUpdate.department_id = dimensions.department_id;
      const persistedTaxCodeId = await ensurePersistedTaxCode(supabase, organizationId, taxCode);
      if (persistedTaxCodeId) ccTxUpdate.tax_code_id = persistedTaxCodeId;
      if (postedTaxTotal > 0) {
        ccTxUpdate.tax_amount = postedTaxTotal;
        ccTxUpdate.subtotal_amount = grossAmount - postedTaxTotal;
      }
      if (taxBreakdown && taxBreakdown.length > 0) {
        ccTxUpdate.tax_breakdown = taxBreakdown;
      }
      const { error: updateError } = await supabase
        .from('credit_card_transactions')
        .update(allowUnreconciledBankUpdate(ccTxUpdate, existingTx))
        .eq('id', transactionId);

      if (updateError) {
        console.error('Transaction update error:', updateError);
        throw new Error(`Failed to update transaction: ${updateError.message}`);
      }

      return { journalEntryId, transactionId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credit-card-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['credit-cards'] });
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast.success('Transaction posted to General Ledger');
    },
    onError: (error: Error) => {
      toast.error(`Failed to post transaction: ${error.message}`);
    },
  });
}

/**
 * Bulk post multiple credit card transactions to GL
 */
export function useBulkPostCreditCardToGL() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (transactions: PostCreditCardTransactionToGLParams[]) => {
      const results = [];

      for (const params of transactions) {
        const {
          transactionId,
          creditCardId,
          glAccountId,
          organizationId,
          amount,
          transactionType,
          description,
          transactionDate,
          category,
          payeePayor,
          reference,
        } = params;

        // Get the credit card's linked GL account
        const { data: creditCard, error: ccError } = await supabase
          .from('credit_cards')
          .select('gl_account_id, name')
          .eq('id', creditCardId)
          .single();

        if (ccError || !creditCard?.gl_account_id) {
          console.error(`Skipping transaction ${transactionId}: Credit card not linked to GL`);
          continue;
        }

        // Idempotency: skip if already linked to a JE
        const { data: existingTx } = await supabase
          .from('credit_card_transactions')
          .select('journal_entry_id')
          .eq('id', transactionId)
          .maybeSingle();
        if (existingTx?.journal_entry_id) {
          results.push({ transactionId, journalEntryId: existingTx.journal_entry_id, success: true });
          continue;
        }

        const payeeInfo = payeePayor ? ` - ${payeePayor}` : '';
        const absAmount = Math.abs(amount);

        // Reverse dedupe for bulk payment branch
        if (transactionType === 'payment') {
          const bankCandidates = await findBankPaymentJEForCC(
            creditCard.gl_account_id, absAmount, organizationId, transactionDate
          );
          if (bankCandidates.length === 1) {
            const m = bankCandidates[0];
            await linkCCTransactionToExistingBankPayment(
              transactionId, m.journalEntryId, glAccountId, m.bankTransactionId
            );
            results.push({ transactionId, journalEntryId: m.journalEntryId, success: true });
            continue;
          }
          if (bankCandidates.length > 1) {
            await queueAmbiguousMatch({
              organizationId,
              reason: 'ambiguous_cc_payment',
              candidates: bankCandidates.map(c => ({
                id: c.journalEntryId, date: c.date, amount: c.amount,
                description: c.reference, reference: c.reference,
              })),
            });
            results.push({ transactionId, success: false, error: new Error('Ambiguous — queued for review') });
            continue;
          }
        }

        // Build lines based on transaction type
        let lines: Array<{ account_id: string; debit: number; credit: number; memo: string }>;

        if (transactionType === 'charge' || transactionType === 'fee' || transactionType === 'interest') {
          lines = [
            { account_id: glAccountId, debit: absAmount, credit: 0, memo: category || description },
            { account_id: creditCard.gl_account_id, debit: 0, credit: absAmount, memo: `CC Charge${payeeInfo}: ${description}` },
          ];
        } else if (transactionType === 'payment') {
          lines = [
            { account_id: creditCard.gl_account_id, debit: absAmount, credit: 0, memo: `CC Payment${payeeInfo}: ${description}` },
            { account_id: glAccountId, debit: 0, credit: absAmount, memo: `Payment to ${creditCard.name}` },
          ];
        } else {
          // credit/refund
          lines = [
            { account_id: creditCard.gl_account_id, debit: absAmount, credit: 0, memo: `CC Credit${payeeInfo}: ${description}` },
            { account_id: glAccountId, debit: 0, credit: absAmount, memo: `Refund - ${description}` },
          ];
        }

        try {
          const journalReference = `CC-${transactionId.slice(0, 8).toUpperCase()}`;
          const ccRefInfo = reference ? ` (Ref: ${reference})` : '';
          const typeLabel = 
            transactionType === 'charge' ? 'Charge' :
            transactionType === 'payment' ? 'Payment' :
            transactionType === 'credit' ? 'Credit' :
            transactionType === 'fee' ? 'Fee' : 'Interest';

          const journalEntryId = await createJournalEntry({
            organizationId,
            date: transactionDate,
            description: `CC ${typeLabel}${payeeInfo}: ${description}${ccRefInfo}`,
            reference: journalReference,
            lines,
            status: 'posted',
          });

          const { data: existingBulk } = await supabase
            .from('credit_card_transactions')
            .select('status, is_cleared')
            .eq('id', transactionId)
            .maybeSingle();
          await supabase
            .from('credit_card_transactions')
            .update(allowUnreconciledBankUpdate({
              journal_entry_id: journalEntryId,
              gl_account_id: glAccountId,
              status: 'matched',
            }, existingBulk))
            .eq('id', transactionId);

          results.push({ transactionId, journalEntryId, success: true });
        } catch (error) {
          console.error(`Failed to post CC transaction ${transactionId}:`, error);
          results.push({ transactionId, success: false, error });
        }
      }

      return results;
    },
    onSuccess: (results) => {
      const successCount = results.filter(r => r.success).length;
      queryClient.invalidateQueries({ queryKey: ['credit-card-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['credit-cards'] });
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      if (successCount > 0) {
        toast.success(`Posted ${successCount} transaction(s) to General Ledger`);
      }
    },
    onError: (error: Error) => {
      toast.error(`Failed to post transactions: ${error.message}`);
    },
  });
}
