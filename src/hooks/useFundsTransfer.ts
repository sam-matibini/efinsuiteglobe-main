import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { createJournalEntry, JournalEntryLine } from './useJournalEntryCreation';
import { toast } from 'sonner';

export type TransferAccountType = 'bank' | 'credit_card';

export interface TransferAccount {
  id: string;
  type: TransferAccountType;
  name: string;
  gl_account_id: string | null;
  current_balance: number;
  currency: string;
}

export interface FundsTransferInput {
  organizationId: string;
  fromAccount: TransferAccount;
  toAccount: TransferAccount;
  /** Amount leaving fromAccount, in fromAccount.currency */
  amount: number;
  /** Amount arriving in toAccount, in toAccount.currency.
   *  Required when fromAccount.currency !== toAccount.currency. */
  toAmount?: number;
  /** Optional FX overrides (FC -> base). Resolved from exchange_rates if omitted. */
  fromExchangeRate?: number;
  toExchangeRate?: number;
  transferDate: string;
  reference?: string;
  memo?: string;
}

async function getNextTransferReference(organizationId: string): Promise<string> {
  const { data: lastEntry } = await supabase
    .from('journal_entries')
    .select('reference')
    .eq('organization_id', organizationId)
    .ilike('reference', 'TRF-%')
    .order('created_at', { ascending: false })
    .limit(1);

  if (lastEntry && lastEntry.length > 0) {
    const match = lastEntry[0].reference?.match(/TRF-(\d+)/);
    if (match) {
      const nextNum = parseInt(match[1], 10) + 1;
      return `TRF-${String(nextNum).padStart(4, '0')}`;
    }
  }
  return 'TRF-0001';
}

/** Look up nearest exchange rate (from -> to) on/before a given date. */
async function getNearestRate(
  organizationId: string,
  from: string,
  to: string,
  date: string,
): Promise<number | null> {
  if (from === to) return 1;
  const { data } = await supabase
    .from('exchange_rates')
    .select('rate')
    .eq('organization_id', organizationId)
    .eq('from_currency', from)
    .eq('to_currency', to)
    .lte('effective_date', date)
    .order('effective_date', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.rate ? Number(data.rate) : null;
}

/**
 * Hook for transferring funds between bank accounts and/or credit cards.
 *
 * Same-currency:  2-line journal (Dr to / Cr from).
 * Cross-currency: 3-line journal (Dr to in toCur, Cr from in fromCur,
 *                 + Realized FX Gain/Loss to balance in base currency).
 */
export function useFundsTransfer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: FundsTransferInput) => {
      const {
        organizationId,
        fromAccount,
        toAccount,
        amount,
        toAmount: toAmountInput,
        fromExchangeRate,
        toExchangeRate,
        transferDate,
        reference,
        memo,
      } = input;

      if (!fromAccount.gl_account_id) {
        throw new Error(`${fromAccount.name} is not linked to a GL account.`);
      }
      if (!toAccount.gl_account_id) {
        throw new Error(`${toAccount.name} is not linked to a GL account.`);
      }

      const transferRef = reference || (await getNextTransferReference(organizationId));
      const description = memo || `Transfer from ${fromAccount.name} to ${toAccount.name}`;

      const isCrossCurrency = fromAccount.currency !== toAccount.currency;

      let journalLines: JournalEntryLine[];

      if (!isCrossCurrency) {
        // Same currency — simple 2-leg
        journalLines = [
          {
            account_id: toAccount.gl_account_id,
            debit: amount,
            credit: 0,
            memo: `Transfer from ${fromAccount.name}`,
            currency: toAccount.currency,
            exchange_rate: 1,
          },
          {
            account_id: fromAccount.gl_account_id,
            debit: 0,
            credit: amount,
            memo: `Transfer to ${toAccount.name}`,
            currency: fromAccount.currency,
            exchange_rate: 1,
          },
        ];
      } else {
        // Cross-currency — need org base currency + realized FX account
        const { data: org, error: orgErr } = await supabase
          .from('organizations')
          .select('currency, realized_fx_account_id')
          .eq('id', organizationId)
          .single();
        if (orgErr) throw orgErr;
        const baseCur = org.currency || 'USD';
        if (!org.realized_fx_account_id) {
          throw new Error(
            'Realized FX Gain/Loss account not configured. Set it in Multi-Currency Settings before recording cross-currency transfers.',
          );
        }

        const toAmount = toAmountInput ?? amount;

        // Resolve rates (FC -> base)
        const fromRate =
          fromExchangeRate ??
          (fromAccount.currency === baseCur
            ? 1
            : (await getNearestRate(organizationId, fromAccount.currency, baseCur, transferDate)) ?? null);
        const toRate =
          toExchangeRate ??
          (toAccount.currency === baseCur
            ? 1
            : (await getNearestRate(organizationId, toAccount.currency, baseCur, transferDate)) ?? null);

        if (!fromRate) {
          throw new Error(`No exchange rate found for ${fromAccount.currency} → ${baseCur} on ${transferDate}.`);
        }
        if (!toRate) {
          throw new Error(`No exchange rate found for ${toAccount.currency} → ${baseCur} on ${transferDate}.`);
        }

        const baseFrom = Math.round(amount * fromRate * 100) / 100;
        const baseTo = Math.round(toAmount * toRate * 100) / 100;
        const spread = Math.round((baseFrom - baseTo) * 100) / 100;

        journalLines = [
          {
            account_id: toAccount.gl_account_id,
            debit: toAmount,
            credit: 0,
            memo: `Transfer from ${fromAccount.name}`,
            currency: toAccount.currency,
            exchange_rate: toRate,
          },
          {
            account_id: fromAccount.gl_account_id,
            debit: 0,
            credit: amount,
            memo: `Transfer to ${toAccount.name}`,
            currency: fromAccount.currency,
            exchange_rate: fromRate,
          },
        ];

        if (Math.abs(spread) >= 0.01) {
          // spread > 0  => baseFrom > baseTo => CREDIT FX gain
          // spread < 0  => baseFrom < baseTo => DEBIT FX loss
          journalLines.push({
            account_id: org.realized_fx_account_id,
            debit: spread < 0 ? Math.abs(spread) : 0,
            credit: spread > 0 ? spread : 0,
            memo: `Realized FX ${spread > 0 ? 'gain' : 'loss'} on ${fromAccount.currency}→${toAccount.currency} transfer`,
            currency: baseCur,
            exchange_rate: 1,
          });
        }
      }

      const journalEntryId = await createJournalEntry({
        organizationId,
        date: transferDate,
        description,
        reference: transferRef,
        lines: journalLines,
        status: 'posted',
        journalType: 'bank',
      });

      // Bank/CC sub-ledger transactions — store the native amount on each side
      if (fromAccount.type === 'bank') {
        const { error } = await supabase.from('bank_transactions').insert({
          bank_account_id: fromAccount.id,
          transaction_date: transferDate,
          description,
          amount,
          transaction_type: 'withdrawal',
          category: 'Transfer',
          reference: transferRef,
          payee_payor: toAccount.name,
          status: 'matched',
          gl_account_id: toAccount.gl_account_id,
          journal_entry_id: journalEntryId,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.from('credit_card_transactions').insert({
          credit_card_id: fromAccount.id,
          transaction_date: transferDate,
          description,
          amount,
          transaction_type: 'payment',
          category: 'Transfer',
          reference: transferRef,
          payee_payor: toAccount.name,
          status: 'posted',
          gl_account_id: toAccount.gl_account_id,
          journal_entry_id: journalEntryId,
        });
        if (error) throw error;
      }

      const destAmount = isCrossCurrency ? (toAmountInput ?? amount) : amount;
      if (toAccount.type === 'bank') {
        const { error } = await supabase.from('bank_transactions').insert({
          bank_account_id: toAccount.id,
          transaction_date: transferDate,
          description,
          amount: destAmount,
          transaction_type: 'deposit',
          category: 'Transfer',
          reference: transferRef,
          payee_payor: fromAccount.name,
          status: 'matched',
          gl_account_id: fromAccount.gl_account_id,
          journal_entry_id: journalEntryId,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.from('credit_card_transactions').insert({
          credit_card_id: toAccount.id,
          transaction_date: transferDate,
          description,
          amount: destAmount,
          transaction_type: 'charge',
          category: 'Transfer',
          reference: transferRef,
          payee_payor: fromAccount.name,
          status: 'posted',
          gl_account_id: fromAccount.gl_account_id,
          journal_entry_id: journalEntryId,
        });
        if (error) throw error;
      }

      return { journalEntryId, reference: transferRef };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['bank-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['credit-card-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['credit-cards'] });
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast.success('Funds transferred successfully');
    },
    onError: (error: Error) => {
      toast.error(`Transfer failed: ${error.message}`);
    },
  });
}

/**
 * Credit card payment from bank account (same-currency assumed).
 */
export function useCreditCardPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      organizationId: string;
      bankAccount: TransferAccount;
      creditCard: TransferAccount;
      amount: number;
      paymentDate: string;
      reference?: string;
      memo?: string;
    }) => {
      const { organizationId, bankAccount, creditCard, amount, paymentDate, reference, memo } = input;

      if (!bankAccount.gl_account_id) {
        throw new Error(`${bankAccount.name} is not linked to a GL account.`);
      }
      if (!creditCard.gl_account_id) {
        throw new Error(`${creditCard.name} is not linked to a GL account.`);
      }

      const paymentRef = reference || (await getNextTransferReference(organizationId));
      const description = memo || `Credit Card Payment - ${creditCard.name}`;

      const journalEntryId = await createJournalEntry({
        organizationId,
        date: paymentDate,
        description,
        reference: paymentRef,
        lines: [
          {
            account_id: creditCard.gl_account_id,
            debit: amount,
            credit: 0,
            memo: `Payment to ${creditCard.name}`,
          },
          {
            account_id: bankAccount.gl_account_id,
            debit: 0,
            credit: amount,
            memo: `Credit card payment from ${bankAccount.name}`,
          },
        ],
        status: 'posted',
      });

      await supabase.from('bank_transactions').insert({
        bank_account_id: bankAccount.id,
        transaction_date: paymentDate,
        description,
        amount,
        transaction_type: 'withdrawal',
        category: 'Credit Card Payment',
        reference: paymentRef,
        payee_payor: creditCard.name,
        status: 'matched',
        gl_account_id: creditCard.gl_account_id,
        journal_entry_id: journalEntryId,
      });

      await supabase.from('credit_card_transactions').insert({
        credit_card_id: creditCard.id,
        transaction_date: paymentDate,
        description,
        amount,
        transaction_type: 'payment',
        category: 'Payment',
        reference: paymentRef,
        payee_payor: bankAccount.name,
        status: 'posted',
        gl_account_id: bankAccount.gl_account_id,
        journal_entry_id: journalEntryId,
      });

      return { journalEntryId, reference: paymentRef };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['bank-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['credit-card-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['credit-cards'] });
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast.success('Credit card payment recorded successfully');
    },
    onError: (error: Error) => {
      toast.error(`Payment failed: ${error.message}`);
    },
  });
}
