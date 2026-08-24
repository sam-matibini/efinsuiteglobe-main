import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { createJournalEntry } from './useJournalEntryCreation';
import { TaxCode } from './useSalesTax';
import { ensurePersistedTaxCode } from '@/lib/persistTaxCode';
import { toast } from 'sonner';
import { JournalEntryLineDimensions } from './useJournalEntryCreation';
import {
  findBankPaymentJEForCC,
  linkCCTransactionToExistingBankPayment,
  queueAmbiguousMatch,
} from './usePaymentMatching';

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
        .select('journal_entry_id')
        .eq('id', transactionId)
        .maybeSingle();

      if (existingTxError) {
        console.error('Existing transaction lookup error:', existingTxError);
        throw new Error(`Failed to validate transaction state: ${existingTxError.message}`);
      }

      if (existingTx?.journal_entry_id) {
        return { journalEntryId: existingTx.journal_entry_id, transactionId };
      }

      // Calculate amounts for journal entries
      // CRITICAL: The CC Loan liability must be credited for the FULL transaction amount
      // (gross, including tax) since that's what is actually owed on the card.
      // The expense account gets the net amount, and tax accounts get the tax portion.
      const grossAmount = Math.abs(amount); // Full amount including any tax
      
      // Determine tax breakdown for separate posting
      // Determine tax breakdown for separate posting
      let taxToPost: Array<{ code: string; amount: number; glAccountId: string }> = [];
      
      if (taxBreakdown && taxBreakdown.length > 0) {
        // Defensive guard: PST must NOT collapse onto the GST ITC account.
        const gstLine = taxBreakdown.find(t => /^GST$/i.test(t.code));
        const pstCollidesWithGst = taxBreakdown.some(
          t => /^PST/i.test(t.code) && t.glAccountId && gstLine?.glAccountId && t.glAccountId === gstLine.glAccountId
        );
        if (pstCollidesWithGst) {
          toast.error(
            'PST Paid account is not configured. Open Sales Tax Settings → assign a "PST Paid (Non-Recoverable)" expense account before posting.'
          );
          throw new Error('PST_PAID_ACCOUNT_NOT_CONFIGURED');
        }
        // For split taxes, post each component that has a GL account
        taxToPost = taxBreakdown
          .filter(t => t.glAccountId && t.amount > 0)
          .map(t => ({ code: t.code, amount: Math.abs(t.amount), glAccountId: t.glAccountId }));
      } else if (taxCode && taxAmount && Math.abs(taxAmount) > 0 && taxCode.gl_paid_account_id) {
        // Single tax with GL account
        taxToPost = [{ code: taxCode.code, amount: Math.abs(taxAmount), glAccountId: taxCode.gl_paid_account_id }];
      }

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
        // REVERSE DEDUPE: if the bank side already posted a withdrawal that debited
        // this CC liability for the same amount within ±7 days, link to that JE
        // instead of creating a duplicate.
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
            creditCard.gl_account_id,
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

      // Create the journal entry
      let journalEntryId: string;
      const typeLabel = 
        transactionType === 'charge' ? 'Charge' :
        transactionType === 'payment' ? 'Payment' :
        transactionType === 'credit' ? 'Credit' :
        transactionType === 'fee' ? 'Fee' : 'Interest';

      // IMPORTANT: journal_entries.reference is unique per org
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
        .update(ccTxUpdate)
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
              transactionId, m.journalEntryId, creditCard.gl_account_id, m.bankTransactionId
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

          await supabase
            .from('credit_card_transactions')
            .update({
              journal_entry_id: journalEntryId,
              gl_account_id: glAccountId,
              status: 'matched',
            })
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
