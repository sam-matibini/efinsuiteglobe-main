import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from './useOrganization';
import { toast } from 'sonner';
import { useBankAccounts } from './useBankAccounts';
import { parseLocalDate } from '@/lib/utils';

export interface ReconciliationItem {
  id: string;
  bank_account_id: string;
  transaction_date: string;
  description: string;
  amount: number;
  transaction_type: string;
  is_cleared: boolean;
  cleared_at: string | null;
  status: string;
  reference: string | null;
  category: string | null;
  source: 'bank_transaction' | 'journal_entry';
  journal_entry_id?: string;
}

export interface BankReconciliation {
  id: string;
  bank_account_id: string;
  statement_date: string;
  statement_balance: number;
  reconciled_balance: number | null;
  difference: number | null;
  status: string;
  notes: string | null;
  completed_at: string | null;
  completed_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface StartReconciliationInput {
  bank_account_id: string;
  statement_date: string;
  statement_balance: number;
}

export function useReconciliation(bankAccountId?: string, statementDate?: string) {
  const { organization } = useCurrentOrganization();
  const queryClient = useQueryClient();

  // Fetch bank account details (used for GL link + reconciliation opening balance)
  const { data: bankAccountData } = useQuery({
    queryKey: ['bank-account-gl', bankAccountId],
    queryFn: async () => {
      if (!bankAccountId) return null;
      const { data, error } = await supabase
        .from('bank_accounts')
        .select('gl_account_id, opening_balance, last_reconciled_balance, name')
        .eq('id', bankAccountId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!bankAccountId,
  });

  const openingBalance = Math.round(
    (Number(bankAccountData?.last_reconciled_balance ?? bankAccountData?.opening_balance ?? 0)) * 100
  ) / 100;

  // Fetch transactions: bank_transactions + unlinked journal entries affecting the GL account
  const { data: transactions = [], isLoading: loadingTransactions } = useQuery({
    queryKey: ['reconciliation-transactions', bankAccountId, bankAccountData?.gl_account_id],
    queryFn: async () => {
      if (!bankAccountId) return [];
      
      // Fetch bank transactions
      const { data: bankTxns, error: bankError } = await supabase
        .from('bank_transactions')
        .select('*')
        .eq('bank_account_id', bankAccountId)
        .order('transaction_date', { ascending: false });

      if (bankError) throw bankError;
      
       const bankTransactions: ReconciliationItem[] = (bankTxns || []).map((t: any) => {
         const rawAmount = Number(t.amount) || 0;
         const normalizedAmount = t.transaction_type === 'withdrawal'
           ? -Math.abs(rawAmount)
           : Math.abs(rawAmount);

         return {
           ...t,
           amount: normalizedAmount,
           source: 'bank_transaction' as const,
         };
       });

      // If GL account is linked, also fetch journal entry lines not tied to bank transactions
      if (bankAccountData?.gl_account_id) {
        const { data: journalLines, error: journalError } = await supabase
          .from('journal_entry_lines')
          .select(`
            id,
            journal_entry_id,
            account_id,
            description,
            debit,
            credit,
            journal_entry:journal_entries!inner(
              id,
              reference,
              entry_date,
              description,
              status
            )
          `)
          .eq('account_id', bankAccountData.gl_account_id);

        if (journalError) throw journalError;

        // Get all bank transactions journal_entry_ids to exclude already-linked entries
        const linkedJournalIds = new Set(
          bankTransactions.filter(t => t.journal_entry_id).map(t => t.journal_entry_id)
        );

        // Convert unlinked journal entries to reconciliation items
        const journalEntryItems: ReconciliationItem[] = (journalLines || [])
          .filter(line => {
            const je = line.journal_entry as any;
            // Only include posted entries not already linked to a bank transaction
            return je?.status === 'posted' && !linkedJournalIds.has(je.id);
          })
          .map(line => {
            const je = line.journal_entry as any;
            const debit = Number(line.debit) || 0;
            const credit = Number(line.credit) || 0;
            const amount = debit - credit; // Positive = debit (deposit), Negative = credit (withdrawal)
            
            return {
              id: `je-${line.id}`, // Prefix to distinguish from bank transaction IDs
              bank_account_id: bankAccountId,
              transaction_date: je.entry_date,
              description: line.description || je.description || 'Journal Entry',
              amount,
              transaction_type: amount >= 0 ? 'deposit' : 'withdrawal',
              is_cleared: false, // Journal entries start uncleared
              cleared_at: null,
              status: 'categorized',
              reference: je.reference,
              category: 'Journal Entry',
              source: 'journal_entry' as const,
              journal_entry_id: je.id,
            };
          });

        // Merge and sort by date
        const allItems = [...bankTransactions, ...journalEntryItems];
        allItems.sort((a, b) => parseLocalDate(b.transaction_date).getTime() - parseLocalDate(a.transaction_date).getTime());
        
        return allItems;
      }

      return bankTransactions;
    },
    enabled: !!bankAccountId,
  });

  // Fetch current/pending reconciliation
  const { data: currentReconciliation, isLoading: loadingReconciliation } = useQuery({
    queryKey: ['current-reconciliation', bankAccountId],
    queryFn: async () => {
      if (!bankAccountId) return null;
      
      const { data, error } = await supabase
        .from('bank_reconciliations')
        .select('*')
        .eq('bank_account_id', bankAccountId)
        .eq('status', 'in_progress')
        .maybeSingle();

      if (error) throw error;
      return data as BankReconciliation | null;
    },
    enabled: !!bankAccountId,
  });

  // Book balance as-of statement date (for GL-linked accounts)
  const effectiveStatementDate = statementDate || currentReconciliation?.statement_date;
  const { data: bookBalanceAsOfStatementDate } = useQuery({
    queryKey: ['bank-book-balance-at-date', organization?.id, bankAccountId, bankAccountData?.gl_account_id, effectiveStatementDate],
    queryFn: async () => {
      if (!organization?.id || !bankAccountData?.gl_account_id || !effectiveStatementDate) return null;

      const { data: glAccount, error: glError } = await supabase
        .from('accounts')
        .select('opening_balance, normal_balance')
        .eq('id', bankAccountData.gl_account_id)
        .single();
      if (glError) throw glError;

      const { data: journalEntries, error: jeError } = await supabase
        .from('journal_entries')
        .select('id')
        .eq('organization_id', organization.id)
        .eq('status', 'posted')
        .lte('entry_date', effectiveStatementDate);
      if (jeError) throw jeError;

      const ids = (journalEntries || []).map((j) => j.id);
      if (ids.length === 0) return Math.round((Number(glAccount.opening_balance) || 0) * 100) / 100;

      const { data: lines, error: linesError } = await supabase
        .from('journal_entry_lines')
        .select('debit, credit')
        .eq('account_id', bankAccountData.gl_account_id)
        .in('journal_entry_id', ids);
      if (linesError) throw linesError;

      const totalDebits = (lines || []).reduce((s, l) => s + (Number(l.debit) || 0), 0);
      const totalCredits = (lines || []).reduce((s, l) => s + (Number(l.credit) || 0), 0);

      let bal = Number(glAccount.opening_balance) || 0;
      if (glAccount.normal_balance === 'debit') {
        bal += totalDebits - totalCredits;
      } else {
        bal += totalCredits - totalDebits;
      }

      return Math.round(bal * 100) / 100;
    },
    enabled: !!organization?.id && !!bankAccountId && !!bankAccountData?.gl_account_id && !!effectiveStatementDate,
  });

  // Start a new reconciliation
  const startReconciliation = useMutation({
    mutationFn: async (input: StartReconciliationInput) => {
      const { data, error } = await supabase
        .from('bank_reconciliations')
        .insert([{
          bank_account_id: input.bank_account_id,
          statement_date: input.statement_date,
          statement_balance: input.statement_balance,
          status: 'in_progress',
        }])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['current-reconciliation'] });
      toast.success('Reconciliation started');
    },
    onError: (error) => {
      toast.error('Failed to start reconciliation: ' + error.message);
    },
  });

  // Update reconciliation statement details
  const updateReconciliation = useMutation({
    mutationFn: async ({ reconciliationId, statement_date, statement_balance }: {
      reconciliationId: string;
      statement_date?: string;
      statement_balance?: number;
    }) => {
      const updates: Record<string, any> = {};
      if (statement_date !== undefined) updates.statement_date = statement_date;
      if (statement_balance !== undefined) updates.statement_balance = statement_balance;

      const { data, error } = await supabase
        .from('bank_reconciliations')
        .update(updates)
        .eq('id', reconciliationId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['current-reconciliation'] });
      toast.success('Statement details updated');
    },
    onError: (error) => {
      toast.error('Failed to update statement: ' + error.message);
    },
  });

  // Toggle transaction cleared status
  const toggleCleared = useMutation({
    mutationFn: async ({ transactionId, cleared }: { transactionId: string; cleared: boolean }) => {
      // Check if this is a journal entry item (prefixed with 'je-')
      if (transactionId.startsWith('je-')) {
        // For journal entries, we can't persist cleared status to bank_transactions
        // Instead, the UI should track this in local state or we could create a bank_transaction
        // For now, we'll create a corresponding bank transaction to link the journal entry
        const jeLineId = transactionId.replace('je-', '');
        
        // Find the journal entry line to get details
        const { data: jeLine, error: jeError } = await supabase
          .from('journal_entry_lines')
          .select(`
            id,
            account_id,
            description,
            debit,
            credit,
            journal_entry:journal_entries!inner(
              id,
              reference,
              entry_date,
              description
            )
          `)
          .eq('id', jeLineId)
          .single();

        if (jeError) throw jeError;

         const je = jeLine.journal_entry as any;
         const debit = Number(jeLine.debit) || 0;
         const credit = Number(jeLine.credit) || 0;
         const signedAmount = debit - credit; // +deposit, -withdrawal
         const transactionType = signedAmount >= 0 ? 'deposit' : 'withdrawal';

         // Create a linked bank transaction for this journal entry (store signed amount)
         const { data: newTxn, error: createError } = await supabase
           .from('bank_transactions')
           .insert({
             bank_account_id: bankAccountId,
             transaction_date: je.entry_date,
             description: jeLine.description || je.description || 'Journal Entry',
             amount: signedAmount,
             transaction_type: transactionType,
             status: 'matched',
             reference: je.reference,
             category: 'Journal Entry',
             journal_entry_id: je.id,
             is_cleared: cleared,
             cleared_at: cleared ? new Date().toISOString() : null,
           })
           .select()
           .single();

        if (createError) throw createError;
        return newTxn;
      }

      // Standard bank transaction update
      const { data, error } = await supabase
        .from('bank_transactions')
        .update({ 
          is_cleared: cleared,
          cleared_at: cleared ? new Date().toISOString() : null,
        })
        .eq('id', transactionId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reconciliation-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['bank-transactions'] });
    },
    onError: (error) => {
      toast.error('Failed to update transaction: ' + error.message);
    },
  });

  // Complete reconciliation
  const completeReconciliation = useMutation({
    mutationFn: async ({ reconciliationId, reconciledBalance }: { reconciliationId: string; reconciledBalance: number }) => {
      // Round to 2 decimal places to avoid floating point precision issues
      const roundedBalance = Math.round(reconciledBalance * 100) / 100;
      
      const { data, error } = await supabase
        .from('bank_reconciliations')
        .update({
          status: 'completed',
          reconciled_balance: roundedBalance,
          difference: 0,
          completed_at: new Date().toISOString(),
        })
        .eq('id', reconciliationId)
        .select()
        .single();
      
      if (error) throw error;

      // Update bank account last reconciled info
      if (bankAccountId) {
        await supabase
          .from('bank_accounts')
          .update({
            last_reconciled_at: new Date().toISOString(),
            last_reconciled_balance: roundedBalance,
          })
          .eq('id', bankAccountId);
      }
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['current-reconciliation'] });
      queryClient.invalidateQueries({ queryKey: ['bank-accounts'] });
      toast.success('Reconciliation completed successfully');
    },
    onError: (error) => {
      toast.error('Failed to complete reconciliation: ' + error.message);
    },
  });

  // Calculate cleared/uncleared totals
  const clearedTransactions = transactions.filter(t => t.is_cleared);
  const unclearedTransactions = transactions.filter(t => !t.is_cleared);
  
  const clearedDeposits = clearedTransactions
    .filter(t => t.amount > 0)
    .reduce((sum, t) => sum + t.amount, 0);
  
  const clearedPayments = clearedTransactions
    .filter(t => t.amount < 0)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const unclearedDeposits = unclearedTransactions
    .filter(t => t.amount > 0)
    .reduce((sum, t) => sum + t.amount, 0);
  
  const unclearedPayments = unclearedTransactions
    .filter(t => t.amount < 0)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  return {
    transactions,
    currentReconciliation,
    openingBalance,
    bookBalanceAsOfStatementDate,
    isLoading: loadingTransactions || loadingReconciliation,
    clearedDeposits,
    clearedPayments,
    unclearedDeposits,
    unclearedPayments,
    clearedCount: clearedTransactions.length,
    totalCount: transactions.length,
    startReconciliation,
    updateReconciliation,
    toggleCleared,
    completeReconciliation,
  };
}
