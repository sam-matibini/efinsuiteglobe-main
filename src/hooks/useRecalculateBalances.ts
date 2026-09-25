import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface RecalculateResult {
  accountId: string;
  accountCode: string;
  accountName: string;
  previousBalance: number;
  calculatedBalance: number;
  difference: number;
}

/**
 * Hook to recalculate all account balances from posted journal entries.
 * This ensures data integrity by deriving balances from the source of truth (journal entries).
 */
export function useRecalculateBalances() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (organizationId: string): Promise<RecalculateResult[]> => {
      // Get all accounts for the organization
      const { data: accounts, error: accountsError } = await supabase
        .from('accounts')
        .select('id, code, name, account_type, normal_balance, opening_balance, current_balance, is_header')
        .eq('organization_id', organizationId);
      
      if (accountsError) throw accountsError;
      
      // Get all posted journal entry lines
      const { data: journalEntries, error: jeError } = await supabase
        .from('journal_entries')
        .select('id')
        .eq('organization_id', organizationId)
        .in('status', ['posted', 'reversed']);
      
      if (jeError) throw jeError;
      
      const journalEntryIds = journalEntries?.map(je => je.id) ?? [];
      
      let journalLines: Array<{ account_id: string; debit: number; credit: number }> = [];
      
      if (journalEntryIds.length > 0) {
        const { data: lines, error: linesError } = await supabase
          .from('journal_entry_lines')
          .select('account_id, debit, credit')
          .in('journal_entry_id', journalEntryIds);
        
        if (linesError) throw linesError;
        journalLines = lines ?? [];
      }
      
      const results: RecalculateResult[] = [];
      
      // Calculate and update balances for each account
      for (const account of accounts || []) {
        if (account.is_header) continue;
        
        const accountLines = journalLines.filter(l => l.account_id === account.id);
        const totalDebits = accountLines.reduce((sum, l) => sum + (Number(l.debit) || 0), 0);
        const totalCredits = accountLines.reduce((sum, l) => sum + (Number(l.credit) || 0), 0);
        
        // Calculate balance based on normal balance type
        let calculatedBalance = Number(account.opening_balance) || 0;
        if (account.normal_balance === 'debit') {
          calculatedBalance += totalDebits - totalCredits;
        } else {
          calculatedBalance += totalCredits - totalDebits;
        }
        
        const previousBalance = Number(account.current_balance) || 0;
        const difference = calculatedBalance - previousBalance;
        
        // Only update if there's a difference
        if (Math.abs(difference) > 0.001) {
          const { error: updateError } = await supabase
            .from('accounts')
            .update({ current_balance: calculatedBalance })
            .eq('id', account.id);
          
          if (updateError) throw updateError;
          
          results.push({
            accountId: account.id,
            accountCode: account.code,
            accountName: account.name,
            previousBalance,
            calculatedBalance,
            difference,
          });
        }
      }
      
      return results;
    },
    onSuccess: (results, organizationId) => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['financial-reports'] });
      
      if (results.length === 0) {
        toast.success('All account balances are correct');
      } else {
        toast.success(`Recalculated ${results.length} account balance(s)`);
      }
    },
    onError: (error: Error) => {
      toast.error(`Failed to recalculate balances: ${error.message}`);
    },
  });
}

/**
 * Get a summary of balance discrepancies without updating
 */
export function useBalanceDiscrepancies() {
  return useMutation({
    mutationFn: async (organizationId: string): Promise<RecalculateResult[]> => {
      // Get all accounts for the organization
      const { data: accounts, error: accountsError } = await supabase
        .from('accounts')
        .select('id, code, name, account_type, normal_balance, opening_balance, current_balance, is_header')
        .eq('organization_id', organizationId);
      
      if (accountsError) throw accountsError;
      
      // Get all posted journal entry lines
      const { data: journalEntries, error: jeError } = await supabase
        .from('journal_entries')
        .select('id')
        .eq('organization_id', organizationId)
        .in('status', ['posted', 'reversed']);
      
      if (jeError) throw jeError;
      
      const journalEntryIds = journalEntries?.map(je => je.id) ?? [];
      
      let journalLines: Array<{ account_id: string; debit: number; credit: number }> = [];
      
      if (journalEntryIds.length > 0) {
        const { data: lines, error: linesError } = await supabase
          .from('journal_entry_lines')
          .select('account_id, debit, credit')
          .in('journal_entry_id', journalEntryIds);
        
        if (linesError) throw linesError;
        journalLines = lines ?? [];
      }
      
      const results: RecalculateResult[] = [];
      
      // Check balances for each account
      for (const account of accounts || []) {
        if (account.is_header) continue;
        
        const accountLines = journalLines.filter(l => l.account_id === account.id);
        const totalDebits = accountLines.reduce((sum, l) => sum + (Number(l.debit) || 0), 0);
        const totalCredits = accountLines.reduce((sum, l) => sum + (Number(l.credit) || 0), 0);
        
        let calculatedBalance = Number(account.opening_balance) || 0;
        if (account.normal_balance === 'debit') {
          calculatedBalance += totalDebits - totalCredits;
        } else {
          calculatedBalance += totalCredits - totalDebits;
        }
        
        const previousBalance = Number(account.current_balance) || 0;
        const difference = calculatedBalance - previousBalance;
        
        if (Math.abs(difference) > 0.001) {
          results.push({
            accountId: account.id,
            accountCode: account.code,
            accountName: account.name,
            previousBalance,
            calculatedBalance,
            difference,
          });
        }
      }
      
      return results;
    },
  });
}
