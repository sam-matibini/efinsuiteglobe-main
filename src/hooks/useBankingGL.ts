import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { createJournalEntry } from './useJournalEntryCreation';
import { TaxCode } from './useSalesTax';
import { ensurePersistedTaxCode } from '@/lib/persistTaxCode';
import { toast } from 'sonner';
import { JournalEntryLineDimensions } from './useJournalEntryCreation';
import { 
  findExistingCCPaymentJE, 
  isCreditCardGLAccount, 
  linkBankTransactionToExistingCCPayment,
  isBankGLAccount,
  findExistingBankTransferJE,
  linkBankTransactionToExistingTransfer,
  backlinkCCTransactionByJE,
  queueAmbiguousMatch,
} from './usePaymentMatching';
export interface TaxBreakdownItem {
  code: string;
  rate: number;
  amount: number;
  glAccountId: string | null;
}

export interface PostTransactionToGLParams {
  transactionId: string;
  bankAccountId: string;
  glAccountId: string;
  organizationId: string;
  amount: number;
  transactionType: 'deposit' | 'withdrawal' | 'transfer';
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
 * Hook for posting bank transactions to the General Ledger
 * Creates proper double-entry journal entries
 */
export function usePostTransactionToGL() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: PostTransactionToGLParams) => {
      const {
        transactionId,
        bankAccountId,
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

      // Get the bank account's linked GL account (the cash/bank account)
      const { data: bankAccount, error: bankError } = await supabase
        .from('bank_accounts')
        .select('gl_account_id, name, organization_id, currency')
        .eq('id', bankAccountId)
        .single();

      if (bankError) {
        console.error('Bank account fetch error:', bankError);
        throw new Error(`Failed to fetch bank account: ${bankError.message}`);
      }

      if (!bankAccount) {
        throw new Error('Bank account not found. Please refresh and try again.');
      }

      if (!bankAccount.gl_account_id) {
        throw new Error(`"${bankAccount.name}" is not linked to a GL account. Please go to Banking → Bank Accounts and update the account settings.`);
      }

      // Validate organization ID matches
      if (bankAccount.organization_id !== organizationId) {
        throw new Error('Bank account belongs to a different organization.');
      }

      // Idempotency: if this transaction is already linked to a journal entry, don't create another
      const { data: existingTx, error: existingTxError } = await supabase
        .from('bank_transactions')
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

      // CRITICAL: Check if this is a credit card payment that should link to existing CC-side JE
      // This prevents double-posting when a CC payment appears on both bank and CC statements
      if (transactionType === 'withdrawal' || transactionType === 'transfer') {
        const isCCPayment = await isCreditCardGLAccount(glAccountId);
        
        if (isCCPayment) {
          // Check for existing CC-side payment JE with matching amount + date window
          const existingCCPayments = await findExistingCCPaymentJE(
            glAccountId,
            amount,
            organizationId,
            transactionDate
          );

          if (existingCCPayments.length === 1) {
            const matchedPayment = existingCCPayments[0];
            await linkBankTransactionToExistingCCPayment(
              transactionId,
              matchedPayment.journalEntryId,
              glAccountId
            );
            // Back-link the CC-side tx so both modules show 'matched'
            await backlinkCCTransactionByJE(matchedPayment.journalEntryId);
            return { journalEntryId: matchedPayment.journalEntryId, transactionId, linkedToExisting: true };
          }

          if (existingCCPayments.length > 1) {
            await queueAmbiguousMatch({
              organizationId,
              reason: 'ambiguous_cc_payment',
              bankTransactionId: transactionId,
              candidates: existingCCPayments.map(c => ({
                id: c.journalEntryId,
                date: c.date,
                amount: c.amount,
                description: c.reference,
                reference: c.reference,
              })),
            });
            throw new Error(`Multiple CC payments match $${Math.abs(amount).toFixed(2)} within ±7 days. Sent to Reconciliation Review for manual selection.`);
          }
        }
      }

      // CRITICAL: Check if this targets another bank account's GL (inter-account transfer)
      // This prevents double-posting when the same transfer appears on both bank statements
      {
        const bankCheck = await isBankGLAccount(glAccountId);
        if (bankCheck.isBankAccount && bankCheck.bankAccountId) {
          const existingTransfer = await findExistingBankTransferJE(
            bankCheck.bankAccountId,
            amount,
            organizationId,
            transactionDate
          );

          if (existingTransfer) {
            await linkBankTransactionToExistingTransfer(
              transactionId,
              existingTransfer.journalEntryId,
              glAccountId
            );
            console.log(`Linked bank transaction ${transactionId} to existing transfer JE ${existingTransfer.reference}`);
            return { journalEntryId: existingTransfer.journalEntryId, transactionId, linkedToExisting: true };
          }
        }
      }

      // Calculate total amount including tax
      // CRITICAL: Only include tax in total if we have GL accounts to post to
      // Otherwise the journal entry will be out of balance
      const subtotal = amount;
      
      // Determine if we have valid tax posting accounts
      let effectiveTax = 0;
      if (taxBreakdown && taxBreakdown.length > 0) {
        // For split taxes, only count amounts that have GL accounts
        effectiveTax = taxBreakdown
          .filter(t => t.glAccountId && t.amount > 0)
          .reduce((sum, t) => sum + t.amount, 0);
      } else if (taxCode && taxAmount && taxAmount > 0) {
        // For single tax, only count if we have a GL account
        const hasGLAccount = transactionType === 'deposit' 
          ? taxCode.gl_collected_account_id 
          : taxCode.gl_paid_account_id;
        effectiveTax = hasGLAccount ? taxAmount : 0;
      }
      
      const total = subtotal + effectiveTax;

      // ---- FX translation (Zoho/QBO-style) -----------------------------------
      // When the bank account currency differs from the org base currency, the
      // bank leg posts in foreign currency at the resolved rate; offset/tax legs
      // post in BASE currency (FC × rate) so the JE balances natively.
      const { data: orgRow } = await supabase
        .from('organizations')
        .select('currency')
        .eq('id', organizationId)
        .single();
      const baseCur = orgRow?.currency || 'USD';
      const fc = bankAccount.currency || baseCur;
      const isFx = fc !== baseCur;
      let fxRate = 1;
      if (isFx) {
        const { data: rateRow } = await supabase
          .from('exchange_rates')
          .select('rate')
          .eq('organization_id', organizationId)
          .eq('from_currency', fc)
          .eq('to_currency', baseCur)
          .lte('effective_date', transactionDate)
          .order('effective_date', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!rateRow?.rate) {
          throw new Error(
            `No ${fc} → ${baseCur} exchange rate found on or before ${transactionDate}. Add one in Banking → Exchange Rates and retry.`,
          );
        }
        fxRate = Number(rateRow.rate);
      }
      const toBase = (n: number) => Math.round(n * fxRate * 100) / 100;
      const bankCur = isFx ? fc : baseCur;
      const offsetCur = baseCur;

      // Resolve realized FX gain/loss account for sub-cent rounding plug.
      // Required for any cross-currency posting; without it the JE cannot
      // balance in base currency when the bank leg's base = (FC × stored rate)
      // diverges from the rounded offset leg base.
      let fxPlugAccountId: string | null = null;
      if (isFx) {
        const { data: orgFx } = await supabase
          .from('organizations')
          .select('realized_fx_account_id')
          .eq('id', organizationId)
          .single();
        fxPlugAccountId = orgFx?.realized_fx_account_id ?? null;
        if (!fxPlugAccountId) {
          throw new Error(
            'Configure the Realized FX Gain/Loss account in Multi-Currency Settings before posting foreign-currency bank transactions.',
          );
        }
      }

      // Create journal entry lines based on transaction type with dimension support
      const payeeInfo = payeePayor ? ` - ${payeePayor}` : '';
      const baseDimensions = {
        ...dimensions,
        source_document_type: 'bank_transaction',
        source_document_id: transactionId,
      };
      const lines: Array<{ account_id: string; debit: number; credit: number; memo: string; currency?: string; exchange_rate?: number } & typeof baseDimensions> = [];

      if (transactionType === 'deposit') {
        // Debit Bank for total amount (in bank currency at FX rate)
        lines.push({
          account_id: bankAccount.gl_account_id,
          debit: total,
          credit: 0,
          memo: `Deposit${payeeInfo}: ${description}`,
          currency: bankCur,
          exchange_rate: fxRate,
          ...baseDimensions,
        });
        // Credit Income/Revenue account for subtotal (translated to base)
        lines.push({
          account_id: glAccountId,
          debit: 0,
          credit: toBase(subtotal),
          memo: category || description,
          currency: offsetCur,
          exchange_rate: 1,
          ...baseDimensions,
        });
        if (taxBreakdown && taxBreakdown.length > 0) {
          for (const taxItem of taxBreakdown) {
            if (taxItem.amount > 0 && taxItem.glAccountId) {
              lines.push({
                account_id: taxItem.glAccountId,
                debit: 0,
                credit: toBase(taxItem.amount),
                memo: `${taxItem.code} (${taxItem.rate}%) collected on ${description}`,
                currency: offsetCur,
                exchange_rate: 1,
                ...baseDimensions,
              });
            }
          }
        } else if (taxCode && effectiveTax > 0 && taxCode.gl_collected_account_id) {
          lines.push({
            account_id: taxCode.gl_collected_account_id,
            debit: 0,
            credit: toBase(effectiveTax),
            memo: `${taxCode.code} collected on ${description}`,
            currency: offsetCur,
            exchange_rate: 1,
            ...baseDimensions,
          });
        }
      } else if (transactionType === 'transfer') {
        lines.push({
          account_id: glAccountId,
          debit: toBase(total),
          credit: 0,
          memo: `Transfer out${payeeInfo}: ${description}`,
          currency: offsetCur,
          exchange_rate: 1,
          ...baseDimensions,
        });
        lines.push({
          account_id: bankAccount.gl_account_id,
          debit: 0,
          credit: total,
          memo: `Transfer${payeeInfo}: ${description}`,
          currency: bankCur,
          exchange_rate: fxRate,
          ...baseDimensions,
        });
      } else {
        // Withdrawal
        lines.push({
          account_id: glAccountId,
          debit: toBase(subtotal),
          credit: 0,
          memo: category || description,
          currency: offsetCur,
          exchange_rate: 1,
          ...baseDimensions,
        });
        if (taxBreakdown && taxBreakdown.length > 0) {
          const gstLine = taxBreakdown.find(t => t.code === 'GST' || /^GST$/i.test(t.code));
          for (const taxItem of taxBreakdown) {
            const isPst = /^PST/i.test(taxItem.code);
            if (
              isPst &&
              taxItem.glAccountId &&
              gstLine?.glAccountId &&
              taxItem.glAccountId === gstLine.glAccountId
            ) {
              toast.error(
                'PST Paid account is not configured. Open Sales Tax Settings → assign a "PST Paid (Non-Recoverable)" expense account before posting.'
              );
              throw new Error('PST_PAID_ACCOUNT_NOT_CONFIGURED');
            }
            if (taxItem.amount > 0 && taxItem.glAccountId) {
              lines.push({
                account_id: taxItem.glAccountId,
                debit: toBase(taxItem.amount),
                credit: 0,
                memo: `${taxItem.code} (${taxItem.rate}%) paid on ${description}`,
                currency: offsetCur,
                exchange_rate: 1,
                ...baseDimensions,
              });
            }
          }
        } else if (taxCode && effectiveTax > 0 && taxCode.gl_paid_account_id) {
          lines.push({
            account_id: taxCode.gl_paid_account_id,
            debit: toBase(effectiveTax),
            credit: 0,
            memo: `${taxCode.code} paid on ${description}`,
            currency: offsetCur,
            exchange_rate: 1,
            ...baseDimensions,
          });
        }
        lines.push({
          account_id: bankAccount.gl_account_id,
          debit: 0,
          credit: total,
          memo: `Payment${payeeInfo}: ${description}`,
          currency: bankCur,
          exchange_rate: fxRate,
          ...baseDimensions,
        });
      }

      // Cross-currency rounding plug — DB trigger computes
      // base_currency_(debit|credit) = (debit|credit) × exchange_rate.
      // The bank leg posts FC × rate; offset legs post pre-rounded base. Any
      // sub-cent drift would fail the base-currency balance trigger, so insert
      // a balancing line on the realized FX account.
      if (isFx && fxPlugAccountId) {
        const totalBaseDr = lines.reduce((s, l) => s + l.debit * (l.exchange_rate ?? 1), 0);
        const totalBaseCr = lines.reduce((s, l) => s + l.credit * (l.exchange_rate ?? 1), 0);
        const spread = Math.round((totalBaseDr - totalBaseCr) * 100) / 100;
        if (Math.abs(spread) >= 0.01) {
          lines.push({
            account_id: fxPlugAccountId,
            debit: spread < 0 ? Math.abs(spread) : 0,
            credit: spread > 0 ? spread : 0,
            memo: `Realized FX ${spread > 0 ? 'gain' : 'loss'} on ${fc}→${baseCur} (${transactionDate})`,
            currency: baseCur,
            exchange_rate: 1,
            ...baseDimensions,
          });
        }
      }

      // Create the journal entry
      let journalEntryId: string;
      const typeLabel =
        transactionType === 'deposit'
          ? 'Deposit'
          : transactionType === 'transfer'
            ? 'Transfer'
            : 'Payment';

      // IMPORTANT: journal_entries.reference is unique per org; never reuse imported bank references here.
      const journalReference = `BANK-${transactionId.toUpperCase()}`;
      const bankRefInfo = reference ? ` (Bank Ref: ${reference})` : '';

      try {
        journalEntryId = await createJournalEntry({
          organizationId,
          date: transactionDate,
          description: `${typeLabel}${payeeInfo}: ${description}${bankRefInfo}`,
          reference: journalReference,
          lines,
          status: 'posted',
          departmentId: dimensions?.department_id ?? null,
        });
      } catch (jeError: unknown) {
        // If we hit a duplicate-reference race, reuse the existing journal entry.
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

      // Update bank transaction with the journal entry ID + persist tax data for audit
      const txUpdate: Record<string, unknown> = {
        journal_entry_id: journalEntryId,
        gl_account_id: glAccountId,
        status: 'matched',
      };
      if (dimensions?.department_id) txUpdate.department_id = dimensions.department_id;
      const persistedTaxCodeId = await ensurePersistedTaxCode(supabase, organizationId, taxCode);
      if (persistedTaxCodeId) txUpdate.tax_code_id = persistedTaxCodeId;
      if (effectiveTax > 0) {
        txUpdate.tax_amount = effectiveTax;
        txUpdate.subtotal_amount = subtotal;
      }
      if (taxBreakdown && taxBreakdown.length > 0) {
        txUpdate.tax_breakdown = taxBreakdown;
      }
      const { error: updateError } = await supabase
        .from('bank_transactions')
        .update(txUpdate)
        .eq('id', transactionId);

      if (updateError) {
        console.error('Transaction update error:', updateError);
        throw new Error(`Failed to update transaction: ${updateError.message}`);
      }

      // Update bank account current balance
      const balanceChange = transactionType === 'deposit' ? amount : -amount;
      const { data: currentBalance } = await supabase
        .from('bank_accounts')
        .select('current_balance')
        .eq('id', bankAccountId)
        .single();

      if (currentBalance) {
        await supabase
          .from('bank_accounts')
          .update({ 
            current_balance: Number(currentBalance.current_balance) + balanceChange 
          })
          .eq('id', bankAccountId);
      }

      return { journalEntryId, transactionId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['bank-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast.success('Transaction posted to General Ledger');
    },
    onError: (error: Error) => {
      toast.error(`Failed to post transaction: ${error.message}`);
    },
  });
}

// Donation type inference from bank description
const DONATION_TYPE_MAP: Record<string, string> = {
  'e-transfer': 'e_transfer',
  'etransfer': 'e_transfer',
  'autodeposit': 'e_transfer',
  'cheque': 'cheque',
  'check': 'cheque',
  'wire': 'wire_transfer',
  'credit card': 'credit_card',
  'cash': 'cash',
};

function inferDonationType(description: string): string {
  const lower = description.toLowerCase();
  for (const [keyword, type] of Object.entries(DONATION_TYPE_MAP)) {
    if (lower.includes(keyword)) return type;
  }
  return 'e_transfer';
}

/**
 * Auto-create a donation record for a deposit transaction if it has a linked customer
 * and is categorized as a donation-related income.
 */
async function autoCreateDonationIfEligible(
  transactionId: string,
  organizationId: string,
  amount: number,
  transactionDate: string,
  description: string,
  category?: string,
) {
  // Check if the transaction has a customer_id and no existing donation
  const { data: txn } = await supabase
    .from('bank_transactions')
    .select('customer_id')
    .eq('id', transactionId)
    .maybeSingle();

  if (!txn?.customer_id) return;

  // Check if donation already exists for this transaction
  const { data: existingDonation } = await supabase
    .from('donations')
    .select('id')
    .eq('bank_transaction_id', transactionId)
    .maybeSingle();

  if (existingDonation) return;

  // Determine next donation number
  const { data: existingNums } = await supabase
    .from('donations')
    .select('donation_number')
    .eq('organization_id', organizationId)
    .like('donation_number', 'DON-%')
    .order('created_at', { ascending: false })
    .limit(100);

  let maxNum = 0;
  (existingNums || []).forEach(row => {
    const match = row.donation_number.match(/DON-(\d+)/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    }
  });
  const donationNumber = `DON-${String(maxNum + 1).padStart(5, '0')}`;

  await supabase
    .from('donations')
    .insert({
      organization_id: organizationId,
      donation_number: donationNumber,
      donor_id: txn.customer_id,
      date_received: transactionDate,
      amount,
      currency: 'CAD',
      donation_type: inferDonationType(description) as any,
      bank_transaction_id: transactionId,
      eligible_amount: amount,
      advantage_value: 0,
      notes: category || description,
      status: 'confirmed' as any,
      confirmed_at: new Date().toISOString(),
    });
}

/**
 * Bulk post multiple transactions to GL
 */
export function useBulkPostToGL() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (transactions: PostTransactionToGLParams[]) => {
      const results = [];
      
      for (const params of transactions) {
        const { bankAccountId, glAccountId, organizationId, amount, transactionType, description, transactionDate, transactionId, category, payeePayor, reference } = params;

        // Get the bank account's linked GL account
        const { data: bankAccount, error: bankError } = await supabase
          .from('bank_accounts')
          .select('gl_account_id, name')
          .eq('id', bankAccountId)
          .single();

        if (bankError || !bankAccount.gl_account_id) {
          console.error(`Skipping transaction ${transactionId}: Bank account not linked to GL`);
          continue;
        }

        // Idempotency: skip if already linked to a JE
        const { data: existingTx } = await supabase
          .from('bank_transactions')
          .select('journal_entry_id')
          .eq('id', transactionId)
          .maybeSingle();

        if (existingTx?.journal_entry_id) {
          results.push({ transactionId, journalEntryId: existingTx.journal_entry_id, success: true });
          continue;
        }

        // Check for CC payment duplicate (date-windowed)
        if (transactionType === 'withdrawal' || transactionType === 'transfer') {
          const isCCPayment = await isCreditCardGLAccount(glAccountId);
          if (isCCPayment) {
            const existingCCPayments = await findExistingCCPaymentJE(glAccountId, amount, organizationId, transactionDate);
            if (existingCCPayments.length === 1) {
              await linkBankTransactionToExistingCCPayment(transactionId, existingCCPayments[0].journalEntryId, glAccountId);
              await backlinkCCTransactionByJE(existingCCPayments[0].journalEntryId);
              results.push({ transactionId, journalEntryId: existingCCPayments[0].journalEntryId, success: true });
              continue;
            }
            if (existingCCPayments.length > 1) {
              await queueAmbiguousMatch({
                organizationId,
                reason: 'ambiguous_cc_payment',
                bankTransactionId: transactionId,
                candidates: existingCCPayments.map(c => ({
                  id: c.journalEntryId, date: c.date, amount: c.amount,
                  description: c.reference, reference: c.reference,
                })),
              });
              results.push({ transactionId, success: false, error: new Error('Ambiguous — queued for review') });
              continue;
            }
          }
        }

        // Check for inter-account transfer duplicate (date-windowed)
        const bankCheck = await isBankGLAccount(glAccountId);
        if (bankCheck.isBankAccount && bankCheck.bankAccountId) {
          const existingTransfer = await findExistingBankTransferJE(bankCheck.bankAccountId, amount, organizationId, transactionDate);
          if (existingTransfer) {
            await linkBankTransactionToExistingTransfer(transactionId, existingTransfer.journalEntryId, glAccountId);
            results.push({ transactionId, journalEntryId: existingTransfer.journalEntryId, success: true });
            continue;
          }
        }

        const payeeInfo = payeePayor ? ` - ${payeePayor}` : '';
        const lines = transactionType === 'deposit'
          ? [
              { account_id: bankAccount.gl_account_id, debit: amount, credit: 0, memo: `Deposit${payeeInfo}: ${description}` },
              { account_id: glAccountId, debit: 0, credit: amount, memo: category || description },
            ]
          : [
              { account_id: glAccountId, debit: amount, credit: 0, memo: category || description },
              { account_id: bankAccount.gl_account_id, debit: 0, credit: amount, memo: `Payment${payeeInfo}: ${description}` },
            ];

        try {
          const journalReference = `BANK-${transactionId.toUpperCase()}`;
          const bankRefInfo = reference ? ` (Bank Ref: ${reference})` : '';

          const journalEntryId = await createJournalEntry({
            organizationId,
            date: transactionDate,
            description: `${transactionType === 'deposit' ? 'Deposit' : transactionType === 'transfer' ? 'Transfer' : 'Payment'}${payeeInfo}: ${description}${bankRefInfo}`,
            reference: journalReference,
            lines,
            status: 'posted',
          });

           await supabase
            .from('bank_transactions')
            .update({
              journal_entry_id: journalEntryId,
              gl_account_id: glAccountId,
              status: 'matched',
            })
            .eq('id', transactionId);

          // Auto-create donation record for deposit transactions with a linked donor
          if (transactionType === 'deposit') {
            try {
              await autoCreateDonationIfEligible(transactionId, organizationId, amount, transactionDate, description, category);
            } catch (donErr) {
              console.warn(`Donation auto-record skipped for ${transactionId}:`, donErr);
            }
          }

          results.push({ transactionId, journalEntryId, success: true });
        } catch (error) {
          console.error(`Failed to post transaction ${transactionId}:`, error);
          results.push({ transactionId, success: false, error });
        }
      }

      return results;
    },
    onSuccess: (results) => {
      const successCount = results.filter(r => r.success).length;
      queryClient.invalidateQueries({ queryKey: ['bank-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['bank-accounts'] });
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
