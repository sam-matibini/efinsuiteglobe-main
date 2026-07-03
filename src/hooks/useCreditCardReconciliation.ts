import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from './useOrganization';
import { toast } from 'sonner';
import { useCreditCards } from './useCreditCards';
import { parseLocalDate } from '@/lib/utils';

export interface CreditCardReconciliationItem {
  id: string;
  credit_card_id: string;
  transaction_date: string;
  description: string;
  amount: number;
  transaction_type: string;
  is_cleared: boolean;
  cleared_at: string | null;
  status: string;
  reference: string | null;
  category: string | null;
  source: 'credit_card_transaction' | 'journal_entry';
  journal_entry_id?: string;
}

export interface CreditCardReconciliation {
  id: string;
  credit_card_id: string;
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

export interface StartCCReconciliationInput {
  credit_card_id: string;
  statement_date: string;
  statement_balance: number;
}

export function useCreditCardReconciliation(creditCardId?: string, statementDate?: string) {
  const { organization } = useCurrentOrganization();
  const { creditCards, updateCreditCard } = useCreditCards();
  const queryClient = useQueryClient();

  // Fetch credit card details
  const selectedCard = creditCards.find(c => c.id === creditCardId);

  const openingBalance = Math.round(
    (Number(selectedCard?.last_reconciled_balance ?? selectedCard?.opening_balance ?? 0)) * 100
  ) / 100;

  // Fetch transactions: credit_card_transactions + unlinked journal entries affecting the GL account
  const { data: transactions = [], isLoading: loadingTransactions } = useQuery({
    queryKey: ['cc-reconciliation-transactions', creditCardId, selectedCard?.gl_account_id],
    queryFn: async () => {
      if (!creditCardId) return [];
      
      // Fetch credit card transactions
      const { data: ccTxns, error: ccError } = await supabase
        .from('credit_card_transactions')
        .select('*')
        .eq('credit_card_id', creditCardId)
        .order('transaction_date', { ascending: false });

      if (ccError) throw ccError;
      
      const ccTransactions: CreditCardReconciliationItem[] = (ccTxns || []).map((t: any) => {
        const rawAmount = Number(t.amount) || 0;
        // For credit cards: charges are positive (increase liability), payments are negative (decrease liability)
        const normalizedAmount = (t.transaction_type === 'payment' || t.transaction_type === 'credit')
          ? -Math.abs(rawAmount)
          : Math.abs(rawAmount);

        return {
          ...t,
          amount: normalizedAmount,
          source: 'credit_card_transaction' as const,
        };
      });

      // If GL account is linked, also fetch journal entry lines not tied to CC transactions
      if (selectedCard?.gl_account_id) {
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
          .eq('account_id', selectedCard.gl_account_id);

        if (journalError) throw journalError;

        // Get all CC transactions journal_entry_ids to exclude already-linked entries
        const linkedJournalIds = new Set(
          ccTransactions.filter(t => t.journal_entry_id).map(t => t.journal_entry_id)
        );

        // Convert unlinked journal entries to reconciliation items
        const journalEntryItems: CreditCardReconciliationItem[] = (journalLines || [])
          .filter(line => {
            const je = line.journal_entry as any;
            return je?.status === 'posted' && !linkedJournalIds.has(je.id);
          })
          .map(line => {
            const je = line.journal_entry as any;
            const debit = Number(line.debit) || 0;
            const credit = Number(line.credit) || 0;
            // For liability account: Credit increases (charge), Debit decreases (payment)
            const amount = credit - debit;
            
            return {
              id: `je-${line.id}`,
              credit_card_id: creditCardId,
              transaction_date: je.entry_date,
              description: line.description || je.description || 'Journal Entry',
              amount,
              transaction_type: amount >= 0 ? 'charge' : 'payment',
              is_cleared: false,
              cleared_at: null,
              status: 'categorized',
              reference: je.reference,
              category: 'Journal Entry',
              source: 'journal_entry' as const,
              journal_entry_id: je.id,
            };
          });

        const allItems = [...ccTransactions, ...journalEntryItems];
        allItems.sort((a, b) => parseLocalDate(b.transaction_date).getTime() - parseLocalDate(a.transaction_date).getTime());
        
        return allItems;
      }

      return ccTransactions;
    },
    enabled: !!creditCardId,
  });

  // Fetch current/pending reconciliation from credit_card_reconciliations table
  const { data: currentReconciliation, isLoading: loadingReconciliation } = useQuery({
    queryKey: ['current-cc-reconciliation', creditCardId],
    queryFn: async () => {
      if (!creditCardId) return null;
      
      const { data, error } = await supabase
        .from('credit_card_reconciliations')
        .select('*')
        .eq('credit_card_id', creditCardId)
        .eq('status', 'in_progress')
        .maybeSingle();

      if (error) throw error;
      return data as CreditCardReconciliation | null;
    },
    enabled: !!creditCardId,
  });

  // Book balance as-of statement date (for GL-linked cards)
  const effectiveStatementDate = statementDate || currentReconciliation?.statement_date;
  const { data: bookBalanceAsOfStatementDate } = useQuery({
    queryKey: ['cc-book-balance-at-date', creditCardId, selectedCard?.gl_account_id, effectiveStatementDate],
    queryFn: async () => {
      if (!organization?.id || !selectedCard?.gl_account_id || !effectiveStatementDate) return null;

      const { data: glAccount, error: glError } = await supabase
        .from('accounts')
        .select('opening_balance, normal_balance')
        .eq('id', selectedCard.gl_account_id)
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
        .eq('account_id', selectedCard.gl_account_id)
        .in('journal_entry_id', ids);
      if (linesError) throw linesError;

      const totalDebits = (lines || []).reduce((s, l) => s + (Number(l.debit) || 0), 0);
      const totalCredits = (lines || []).reduce((s, l) => s + (Number(l.credit) || 0), 0);

      let bal = Number(glAccount.opening_balance) || 0;
      // For liability (credit-normal): balance = opening + credits - debits
      if (glAccount.normal_balance === 'credit') {
        bal += totalCredits - totalDebits;
      } else {
        bal += totalDebits - totalCredits;
      }

      return Math.round(bal * 100) / 100;
    },
    enabled: !!organization?.id && !!creditCardId && !!selectedCard?.gl_account_id && !!effectiveStatementDate,
  });

  // Start a new reconciliation
  const startReconciliation = useMutation({
    mutationFn: async (input: StartCCReconciliationInput) => {
      const { data, error } = await supabase
        .from('credit_card_reconciliations')
        .insert([{
          credit_card_id: input.credit_card_id,
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
      queryClient.invalidateQueries({ queryKey: ['current-cc-reconciliation'] });
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
        .from('credit_card_reconciliations')
        .update(updates)
        .eq('id', reconciliationId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['current-cc-reconciliation'] });
      toast.success('Statement details updated');
    },
    onError: (error) => {
      toast.error('Failed to update statement: ' + error.message);
    },
  });

  // Toggle transaction cleared status
  const toggleCleared = useMutation({
    mutationFn: async ({ transactionId, cleared }: { transactionId: string; cleared: boolean }) => {
      // Check if this is a journal entry item
      if (transactionId.startsWith('je-')) {
        const jeLineId = transactionId.replace('je-', '');
        
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
        const signedAmount = credit - debit;
        const transactionType = signedAmount >= 0 ? 'charge' : 'payment';

        const { data: newTxn, error: createError } = await supabase
          .from('credit_card_transactions')
          .insert({
            credit_card_id: creditCardId,
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

      // Standard credit card transaction update
      const { data, error } = await supabase
        .from('credit_card_transactions')
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
      queryClient.invalidateQueries({ queryKey: ['cc-reconciliation-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['credit-card-transactions'] });
    },
    onError: (error) => {
      toast.error('Failed to update transaction: ' + error.message);
    },
  });

  // Complete reconciliation
  const completeReconciliation = useMutation({
    mutationFn: async ({ reconciliationId, reconciledBalance }: { reconciliationId: string; reconciledBalance: number }) => {
      const roundedBalance = Math.round(reconciledBalance * 100) / 100;
      
      const { data, error } = await supabase
        .from('credit_card_reconciliations')
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

      // Update credit card last reconciled info
      if (creditCardId) {
        await supabase
          .from('credit_cards')
          .update({
            last_reconciled_at: new Date().toISOString(),
            last_reconciled_balance: roundedBalance,
          })
          .eq('id', creditCardId);
      }
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['current-cc-reconciliation'] });
      queryClient.invalidateQueries({ queryKey: ['credit-cards'] });
      toast.success('Reconciliation completed successfully');
    },
    onError: (error) => {
      toast.error('Failed to complete reconciliation: ' + error.message);
    },
  });

  // Calculate cleared/uncleared totals
  const clearedTransactions = transactions.filter(t => t.is_cleared);
  const unclearedTransactions = transactions.filter(t => !t.is_cleared);
  
  // For credit cards: charges increase balance, payments decrease
  const clearedCharges = clearedTransactions
    .filter(t => t.amount > 0)
    .reduce((sum, t) => sum + t.amount, 0);
  
  const clearedPayments = clearedTransactions
    .filter(t => t.amount < 0)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const unclearedCharges = unclearedTransactions
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
    clearedCharges,
    clearedPayments,
    unclearedCharges,
    unclearedPayments,
    clearedCount: clearedTransactions.length,
    totalCount: transactions.length,
    startReconciliation,
    updateReconciliation,
    toggleCleared,
    completeReconciliation,
    updateCreditCard,
    selectedCard,
  };
}
