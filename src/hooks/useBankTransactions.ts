import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { createJournalEntry } from './useJournalEntryCreation';
import { reverseLinkedJournalEntry, recalculateAndInvalidate } from './useGLPropagation';

export interface BankTransaction {
  id: string;
  bank_account_id: string;
  transaction_date: string;
  description: string;
  amount: number;
  transaction_type: 'deposit' | 'withdrawal' | 'transfer';
  status: 'pending' | 'unmatched' | 'matched' | 'reconciled';
  category: string | null;
  matched_invoice_id: string | null;
  matched_bill_id: string | null;
  gl_account_id: string | null;
  journal_entry_id: string | null;
  memo: string | null;
  reference: string | null;
  payee_payor: string | null;
  customer_id: string | null;
  department_id?: string | null;
  is_cleared: boolean;
  cleared_at: string | null;
  imported_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateTransactionInput {
  bank_account_id: string;
  transaction_date: string;
  description: string;
  amount: number;
  transaction_type: 'deposit' | 'withdrawal' | 'transfer';
  category?: string;
  memo?: string;
  reference?: string;
  payee_payor?: string;
}

export function useBankTransactions(bankAccountId?: string) {
  const queryClient = useQueryClient();

  const { data: transactions = [], isLoading, error } = useQuery({
    queryKey: ['bank-transactions', bankAccountId],
    queryFn: async () => {
      if (!bankAccountId) return [];
      
      const { data, error } = await supabase
        .from('bank_transactions')
        .select('*')
        .eq('bank_account_id', bankAccountId)
        .order('transaction_date', { ascending: false });
      
      if (error) throw error;
      return data as BankTransaction[];
    },
    enabled: !!bankAccountId,
  });

  const createTransaction = useMutation({
    mutationFn: async (input: CreateTransactionInput) => {
      const { data, error } = await supabase
        .from('bank_transactions')
        .insert({
          bank_account_id: input.bank_account_id,
          transaction_date: input.transaction_date,
          description: input.description,
          amount: input.amount,
          transaction_type: input.transaction_type,
          category: input.category || null,
          memo: input.memo || null,
          reference: input.reference || null,
          payee_payor: input.payee_payor || null,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['bank-accounts'] }); // Refresh cumulative balance
      toast.success('Transaction created');
    },
    onError: (error) => {
      toast.error('Failed to create transaction: ' + error.message);
    },
  });

  const updateTransaction = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<BankTransaction> & { id: string }) => {
      const { data, error } = await supabase
        .from('bank_transactions')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['bank-accounts'] }); // Refresh cumulative balance
    },
    onError: (error) => {
      toast.error('Failed to update transaction: ' + error.message);
    },
  });

  const categorizeTransaction = useMutation({
    mutationFn: async ({ 
      id, 
      category, 
      gl_account_id,
      postToGL = false,
      organizationId,
    }: { 
      id: string; 
      category: string; 
      gl_account_id?: string;
      postToGL?: boolean;
      organizationId?: string;
    }) => {
      // Look up the existing transaction first so we can reverse any prior JE
      const { data: existing, error: existingErr } = await supabase
        .from('bank_transactions')
        .select('journal_entry_id, bank_accounts!inner(organization_id)')
        .eq('id', id)
        .single();
      if (existingErr) throw existingErr;

      const existingOrgId =
        organizationId || (existing?.bank_accounts as any)?.organization_id;

      // Reverse any previously posted JE so we don't double-count
      if (existing?.journal_entry_id && existingOrgId) {
        try {
          await reverseLinkedJournalEntry({
            bankTransactionId: id,
            journalEntryId: existing.journal_entry_id,
            organizationId: existingOrgId,
          });
        } catch (revErr) {
          console.error('Failed to reverse prior journal entry:', revErr);
        }
      }

      // Now update the transaction
      const { data: transaction, error } = await supabase
        .from('bank_transactions')
        .update({
          category,
          gl_account_id: gl_account_id || null,
          status: 'matched',
          journal_entry_id: null,
        })
        .eq('id', id)
        .select('*, bank_accounts!inner(gl_account_id, organization_id)')
        .single();
      
      if (error) throw error;

      const payeeInfo = transaction.payee_payor ? ` - ${transaction.payee_payor}` : '';

      // If posting to GL and we have both accounts
      if (postToGL && gl_account_id && transaction.bank_accounts?.gl_account_id && organizationId) {
        const bankGLAccountId = transaction.bank_accounts.gl_account_id;
        const amount = Math.abs(Number(transaction.amount));
        const isDeposit = transaction.transaction_type === 'deposit';

        // Create journal entry lines
        const lines = isDeposit
          ? [
              { account_id: bankGLAccountId, debit: amount, credit: 0, memo: `Deposit${payeeInfo}: ${transaction.description}` },
              { account_id: gl_account_id, debit: 0, credit: amount, memo: category || transaction.description },
            ]
          : [
              { account_id: gl_account_id, debit: amount, credit: 0, memo: category || transaction.description },
              { account_id: bankGLAccountId, debit: 0, credit: amount, memo: `Payment${payeeInfo}: ${transaction.description}` },
            ];

        try {
          const journalEntryId = await createJournalEntry({
            organizationId,
            date: transaction.transaction_date,
            description: `${isDeposit ? 'Deposit' : 'Payment'}${payeeInfo}: ${transaction.description}`,
            reference: transaction.reference || `BANK-${id.slice(0, 8).toUpperCase()}`,
            lines,
            status: 'posted',
          });

          // Update transaction with journal entry ID
          await supabase
            .from('bank_transactions')
            .update({ journal_entry_id: journalEntryId })
            .eq('id', id);
        } catch (jeError) {
          console.error('Failed to create journal entry:', jeError);
          // Don't throw - transaction is still categorized
        }
      }

      // Recalc balances + invalidate report queries so financial statements refresh
      const orgId =
        organizationId || (transaction.bank_accounts as any)?.organization_id;
      await recalculateAndInvalidate(orgId, queryClient);

      return transaction;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast.success('Transaction categorized');
    },
    onError: (error) => {
      toast.error('Failed to categorize transaction: ' + error.message);
    },
  });

  const importTransactions = useMutation({
    mutationFn: async (newTransactions: CreateTransactionInput[]) => {
      if (!bankAccountId || newTransactions.length === 0) {
        return { imported: [], duplicates: 0 };
      }
      
      // Fetch existing transactions for duplicate detection
      const { data: existingTxns } = await supabase
        .from('bank_transactions')
        .select('transaction_date, description, amount, reference')
        .eq('bank_account_id', bankAccountId);
      
      const existingSet = new Set(
        (existingTxns || []).map(t => 
          `${t.transaction_date}|${t.description?.toLowerCase().trim()}|${Math.abs(Number(t.amount)).toFixed(2)}|${t.reference || ''}`
        )
      );
      
      // Filter out duplicates
      const uniqueTransactions = newTransactions.filter(t => {
        const key = `${t.transaction_date}|${t.description?.toLowerCase().trim()}|${Math.abs(Number(t.amount)).toFixed(2)}|${t.reference || ''}`;
        return !existingSet.has(key);
      });
      
      const duplicateCount = newTransactions.length - uniqueTransactions.length;
      
      if (uniqueTransactions.length === 0) {
        return { imported: [], duplicates: duplicateCount };
      }
      
      const { data, error } = await supabase
        .from('bank_transactions')
        .insert(
          uniqueTransactions.map(t => ({
            bank_account_id: t.bank_account_id,
            transaction_date: t.transaction_date,
            description: t.description,
            amount: t.amount,
            transaction_type: t.transaction_type,
            category: t.category || null,
            reference: t.reference || null,
            payee_payor: t.payee_payor || null,
            imported_at: new Date().toISOString(),
            status: t.category ? 'matched' : 'pending',
          }))
        )
        .select();
      
      if (error) throw error;
      return { imported: data || [], duplicates: duplicateCount };
    },
    onSuccess: ({ imported, duplicates }) => {
      queryClient.invalidateQueries({ queryKey: ['bank-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['bank-accounts'] });
      if (duplicates > 0 && imported.length > 0) {
        toast.success(`Imported ${imported.length} transactions (${duplicates} duplicates skipped)`);
      } else if (duplicates > 0 && imported.length === 0) {
        toast.info(`All ${duplicates} transactions already exist`);
      } else {
        toast.success(`Imported ${imported.length} transactions`);
      }
    },
    onError: (error) => {
      toast.error('Failed to import transactions: ' + error.message);
    },
  });

  const unimportTransactions = useMutation({
    mutationFn: async (transactionIds: string[]) => {
      if (transactionIds.length === 0) return 0;

      // Pull rows so we can reverse any linked journal entries first
      const { data: rows, error: fetchErr } = await supabase
        .from('bank_transactions')
        .select('id, journal_entry_id, bank_accounts!inner(organization_id)')
        .in('id', transactionIds)
        .not('imported_at', 'is', null);
      if (fetchErr) throw fetchErr;

      const orgIds = new Set<string>();
      for (const r of rows || []) {
        const orgId = (r.bank_accounts as any)?.organization_id;
        if (orgId) orgIds.add(orgId);
        if (r.journal_entry_id && orgId) {
          try {
            await reverseLinkedJournalEntry({
              bankTransactionId: r.id,
              journalEntryId: r.journal_entry_id,
              organizationId: orgId,
            });
          } catch (e) {
            console.error('Failed to reverse JE for bank tx', r.id, e);
          }
        }
      }

      const idsToDelete = (rows || []).map(r => r.id);
      if (idsToDelete.length === 0) return 0;

      const { error } = await supabase
        .from('bank_transactions')
        .delete()
        .in('id', idsToDelete);
      if (error) throw error;

      for (const orgId of orgIds) {
        try { await recalculateAndInvalidate(orgId, queryClient); } catch (e) { console.error(e); }
      }

      return idsToDelete.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['bank-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['bank-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast.success(`Removed ${count} imported transaction(s)`);
    },
    onError: (error) => {
      toast.error('Failed to remove transactions: ' + error.message);
    },
  });

  const deleteTransaction = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('bank_transactions')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['bank-accounts'] }); // Refresh cumulative balance
      toast.success('Transaction deleted');
    },
    onError: (error) => {
      toast.error('Failed to delete transaction: ' + error.message);
    },
  });

  // Status definitions:
  // - pending: newly imported from statement, awaiting categorization
  // - unmatched: reviewed but no matching category/GL account found
  // - matched: categorized with GL account assignment
  // - reconciled: cleared during bank statement reconciliation
  
  const pendingTransactions = transactions.filter(t => t.status === 'pending' || (!t.status && !t.category));
  const unmatchedTransactions = transactions.filter(t => t.status === 'unmatched');
  const matchedTransactions = transactions.filter(t => t.status === 'matched' || (t.category && t.status !== 'reconciled' && t.status !== 'unmatched'));
  const reconciledTransactions = transactions.filter(t => t.status === 'reconciled');

  const totalDeposits = transactions
    .filter(t => t.transaction_type === 'deposit')
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const totalWithdrawals = transactions
    .filter(t => t.transaction_type === 'withdrawal')
    .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);

  return {
    transactions,
    isLoading,
    error,
    pendingTransactions,
    unmatchedTransactions,
    matchedTransactions,
    reconciledTransactions,
    totalDeposits,
    totalWithdrawals,
    createTransaction,
    updateTransaction,
    categorizeTransaction,
    importTransactions,
    unimportTransactions,
    deleteTransaction,
  };
}
