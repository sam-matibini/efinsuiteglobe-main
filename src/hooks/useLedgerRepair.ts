import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface RepairResult {
  accountsRecalculated: number;
  entriesReversed: number;
  errors: string[];
}

/**
 * Recalculates all account balances from opening_balance + journal_entry_lines
 * This ensures the current_balance matches the transactional truth.
 */
export function useRecalculateAllBalances() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (organizationId: string): Promise<RepairResult> => {
      const result: RepairResult = {
        accountsRecalculated: 0,
        entriesReversed: 0,
        errors: [],
      };

      // 1. Get all non-header accounts for this organization
      const { data: accounts, error: accountsError } = await supabase
        .from('accounts')
        .select('id, code, name, account_type, normal_balance, opening_balance, current_balance')
        .eq('organization_id', organizationId)
        .eq('is_header', false)
        .eq('is_active', true);

      if (accountsError) {
        throw new Error(`Failed to fetch accounts: ${accountsError.message}`);
      }

      if (!accounts || accounts.length === 0) {
        return result;
      }

      // 2. Get all posted journal entry lines grouped by account
      const { data: journalLines, error: linesError } = await supabase
        .from('journal_entry_lines')
        .select(`
          account_id,
          debit,
          credit,
          journal_entries!inner(status, organization_id)
        `)
      .eq('journal_entries.organization_id', organizationId)
      .in('journal_entries.status', ['posted', 'reversed']);

      if (linesError) {
        throw new Error(`Failed to fetch journal lines: ${linesError.message}`);
      }

      // 3. Calculate correct balance for each account
      const accountTotals = new Map<string, { debits: number; credits: number }>();
      
      for (const line of journalLines || []) {
        const existing = accountTotals.get(line.account_id) || { debits: 0, credits: 0 };
        existing.debits += Number(line.debit) || 0;
        existing.credits += Number(line.credit) || 0;
        accountTotals.set(line.account_id, existing);
      }

      // 4. Update each account's current_balance
      for (const account of accounts) {
        const totals = accountTotals.get(account.id) || { debits: 0, credits: 0 };
        const openingBalance = Number(account.opening_balance) || 0;
        
        // Calculate balance based on normal balance rule
        // Debit-normal: balance = opening + debits - credits
        // Credit-normal: balance = opening + credits - debits
        let calculatedBalance: number;
        if (account.normal_balance === 'debit') {
          calculatedBalance = openingBalance + totals.debits - totals.credits;
        } else {
          calculatedBalance = openingBalance + totals.credits - totals.debits;
        }

        // Round to 2 decimal places to avoid floating point issues
        calculatedBalance = Math.round(calculatedBalance * 100) / 100;
        const currentBalance = Math.round((Number(account.current_balance) || 0) * 100) / 100;

        // Only update if there's a difference
        if (Math.abs(calculatedBalance - currentBalance) > 0.005) {
          const { error: updateError } = await supabase
            .from('accounts')
            .update({ current_balance: calculatedBalance })
            .eq('id', account.id);

          if (updateError) {
            result.errors.push(`Failed to update ${account.code}: ${updateError.message}`);
          } else {
            result.accountsRecalculated++;
            console.log(`Updated ${account.code} ${account.name}: ${currentBalance} → ${calculatedBalance}`);
          }
        }
      }

      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
      queryClient.invalidateQueries({ queryKey: ['financial-reports'] });
      
      if (result.accountsRecalculated > 0) {
        toast.success(`Recalculated ${result.accountsRecalculated} account balance(s)`);
      } else {
        toast.info('All account balances are already correct');
      }
      
      if (result.errors.length > 0) {
        toast.warning(`${result.errors.length} error(s) during recalculation`);
      }
    },
    onError: (error: Error) => {
      toast.error(`Balance recalculation failed: ${error.message}`);
    },
  });
}

/**
 * Identifies and reports problematic journal entries that have unusual patterns:
 * - Entries that only credit liability accounts without corresponding debits
 * - Entries that only debit asset accounts without corresponding credits
 * - Entries that affect AR incorrectly (credits without invoice payments)
 */
export function useIdentifyProblematicEntries() {
  return useMutation({
    mutationFn: async (organizationId: string) => {
      // Get all posted entries with their lines
      const { data: entries, error } = await supabase
        .from('journal_entries')
        .select(`
          id,
          reference,
          description,
          entry_date,
          status,
          journal_entry_lines(
            account_id,
            debit,
            credit,
            description
          )
        `)
        .eq('organization_id', organizationId)
        .eq('status', 'posted')
        .order('entry_date', { ascending: false });

      if (error) throw error;

      // Get account info
      const { data: accounts } = await supabase
        .from('accounts')
        .select('id, code, name, account_type, normal_balance')
        .eq('organization_id', organizationId);

      const accountMap = new Map(accounts?.map(a => [a.id, a]) || []);

      const problems: Array<{
        entryId: string;
        reference: string;
        description: string;
        date: string;
        issue: string;
        lines: Array<{ account: string; debit: number; credit: number }>;
      }> = [];

      for (const entry of entries || []) {
        const lines = (entry.journal_entry_lines as any[]) || [];
        
        // Check for AR credits without being a payment (rule-based deposits incorrectly mapped)
        const arCredits = lines.filter(l => {
          const acc = accountMap.get(l.account_id);
          return acc?.name?.toLowerCase().includes('receivable') && Number(l.credit) > 0;
        });

        if (arCredits.length > 0 && !entry.description?.toLowerCase().includes('payment')) {
          // This might be a deposit incorrectly mapped to AR
          const hasRevenueCredit = lines.some(l => {
            const acc = accountMap.get(l.account_id);
            return acc?.account_type === 'income' && Number(l.credit) > 0;
          });

          if (!hasRevenueCredit) {
            problems.push({
              entryId: entry.id,
              reference: entry.reference,
              description: entry.description,
              date: entry.entry_date,
              issue: 'Deposit credited to AR instead of Revenue',
              lines: lines.map(l => ({
                account: accountMap.get(l.account_id)?.name || l.account_id,
                debit: Number(l.debit),
                credit: Number(l.credit),
              })),
            });
          }
        }

        // Check for liability debits that should be credits (CC opening balance issue)
        const ccDebits = lines.filter(l => {
          const acc = accountMap.get(l.account_id);
          return acc?.name?.toLowerCase().includes('credit card') && 
                 acc?.account_type === 'liability' && 
                 Number(l.debit) > 0 &&
                 !entry.description?.toLowerCase().includes('payment');
        });

        if (ccDebits.length > 0 && entry.reference?.startsWith('CC-OB')) {
          problems.push({
            entryId: entry.id,
            reference: entry.reference,
            description: entry.description,
            date: entry.entry_date,
            issue: 'Credit Card opening balance incorrectly debited liability',
            lines: lines.map(l => ({
              account: accountMap.get(l.account_id)?.name || l.account_id,
              debit: Number(l.debit),
              credit: Number(l.credit),
            })),
          });
        }
      }

      return problems;
    },
  });
}

/**
 * Full ledger repair: recalculates all balances from transactional truth
 */
export function useLedgerRepair() {
  const recalculate = useRecalculateAllBalances();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (organizationId: string) => {
      // Run balance recalculation
      const result = await recalculate.mutateAsync(organizationId);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
      queryClient.invalidateQueries({ queryKey: ['financial-reports'] });
    },
  });
}
