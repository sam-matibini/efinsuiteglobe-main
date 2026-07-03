/**
 * ============================================================================
 * FISCAL YEAR CLOSE HOOK - GAAP/IFRS/ASPE COMPLIANT
 * ============================================================================
 * 
 * This hook provides functionality to:
 * 1. Check for unclosed fiscal years with outstanding net income
 * 2. Perform fiscal year close (transfer net income to Retained Earnings)
 * 3. View fiscal year close history
 * 
 * Per GAAP/IFRS/ASPE, temporary accounts (Income/Expense) must be closed
 * to Retained Earnings at year-end to properly reflect cumulative earnings.
 * 
 * ============================================================================
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from './useOrganization';
import { toast } from 'sonner';

interface UnclosedFiscalYear {
  fiscal_year: number;
  fiscal_year_start: string;
  fiscal_year_end: string;
  net_income: number;
  is_closed: boolean;
}

interface FiscalYearClose {
  id: string;
  organization_id: string;
  fiscal_year: number;
  fiscal_year_start: string;
  fiscal_year_end: string;
  net_income: number;
  retained_earnings_account_id: string;
  closing_journal_entry_id: string | null;
  closed_by: string | null;
  closed_at: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface CloseYearResult {
  success: boolean;
  message: string;
  net_income: number;
  closing_entry_id: string | null;
  fiscal_year_close_id: string | null;
}

export function useFiscalYearClose() {
  const { organization } = useCurrentOrganization();
  const queryClient = useQueryClient();
  const organizationId = organization?.id;

  // Fetch unclosed fiscal years
  const unclosedYearsQuery = useQuery({
    queryKey: ['unclosed-fiscal-years', organizationId],
    queryFn: async (): Promise<UnclosedFiscalYear[]> => {
      if (!organizationId) return [];

      const { data, error } = await supabase
        .rpc('get_unclosed_fiscal_years', { p_organization_id: organizationId });

      if (error) throw error;
      return (data as UnclosedFiscalYear[]) || [];
    },
    enabled: !!organizationId,
  });

  // Fetch fiscal year close history
  const closeHistoryQuery = useQuery({
    queryKey: ['fiscal-year-closes', organizationId],
    queryFn: async (): Promise<FiscalYearClose[]> => {
      if (!organizationId) return [];

      const { data, error } = await supabase
        .from('fiscal_year_closes')
        .select('*')
        .eq('organization_id', organizationId)
        .order('fiscal_year', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!organizationId,
  });

  // Close fiscal year mutation
  const closeYearMutation = useMutation({
    mutationFn: async (params: {
      fiscalYear: number;
      fiscalYearStart: string;
      fiscalYearEnd: string;
      notes?: string;
    }): Promise<CloseYearResult> => {
      if (!organizationId) throw new Error('No organization selected');

      const { data, error } = await supabase
        .rpc('close_fiscal_year', {
          p_organization_id: organizationId,
          p_fiscal_year: params.fiscalYear,
          p_fiscal_year_start: params.fiscalYearStart,
          p_fiscal_year_end: params.fiscalYearEnd,
          p_notes: params.notes || null,
        });

      if (error) throw error;
      
      const result = (data as CloseYearResult[])?.[0];
      if (!result) throw new Error('No result returned from close_fiscal_year');
      
      return result;
    },
    onSuccess: (result) => {
      if (result.success) {
        toast.success(result.message);
        // Invalidate all financial queries to reflect the closing entry
        queryClient.invalidateQueries({ queryKey: ['unclosed-fiscal-years'] });
        queryClient.invalidateQueries({ queryKey: ['fiscal-year-closes'] });
        queryClient.invalidateQueries({ queryKey: ['account-balances'] });
        queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
        queryClient.invalidateQueries({ queryKey: ['financial-reports'] });
      } else {
        toast.error(result.message);
      }
    },
    onError: (error: Error) => {
      toast.error(`Failed to close fiscal year: ${error.message}`);
    },
  });

  // Get years that need closing (unclosed with non-zero net income)
  const yearsNeedingClose = unclosedYearsQuery.data?.filter(
    y => !y.is_closed && Math.abs(y.net_income) > 0.01
  ) || [];

  return {
    unclosedYears: unclosedYearsQuery.data || [],
    yearsNeedingClose,
    closeHistory: closeHistoryQuery.data || [],
    isLoading: unclosedYearsQuery.isLoading || closeHistoryQuery.isLoading,
    isClosing: closeYearMutation.isPending,
    closeYear: closeYearMutation.mutate,
    closeYearAsync: closeYearMutation.mutateAsync,
    refetch: () => {
      unclosedYearsQuery.refetch();
      closeHistoryQuery.refetch();
    },
  };
}
