/**
 * ============================================================================
 * RETAINED EARNINGS ROLLFORWARD HOOK - GAAP/ASPE/IFRS COMPLIANT
 * ============================================================================
 * 
 * This hook provides functionality to:
 * 1. Calculate RE rollforward for any fiscal year
 * 2. View rollforward history with full audit trail
 * 3. Validate continuity across years
 * 4. Get RE balance at any point in time
 * 
 * Formula: RE(Closing) = RE(Opening) + Net Income - Dividends ± Adjustments
 * 
 * ============================================================================
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from './useOrganization';
import { toast } from 'sonner';

export interface RollforwardData {
  opening_balance: number;
  net_income: number;
  dividends: number;
  prior_period_adjustments: number;
  closing_balance: number;
}

export interface RollforwardRecord {
  id: string;
  organization_id: string;
  fiscal_year: number;
  fiscal_year_start: string;
  fiscal_year_end: string;
  retained_earnings_account_id: string;
  opening_balance: number;
  net_income: number;
  dividends: number;
  prior_period_adjustments: number;
  closing_balance: number;
  fiscal_year_close_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContinuityCheck {
  fiscal_year: number;
  prior_closing: number;
  current_opening: number;
  is_continuous: boolean;
  gap: number;
}

export function useRetainedEarningsRollforward() {
  const { organization } = useCurrentOrganization();
  const queryClient = useQueryClient();
  const organizationId = organization?.id;

  // Fetch rollforward history for all fiscal years
  const rollforwardHistoryQuery = useQuery({
    queryKey: ['retained-earnings-rollforward', organizationId],
    queryFn: async (): Promise<RollforwardRecord[]> => {
      if (!organizationId) return [];

      const { data, error } = await supabase
        .from('retained_earnings_rollforward')
        .select('*')
        .eq('organization_id', organizationId)
        .order('fiscal_year', { ascending: false });

      if (error) throw error;
      return (data as RollforwardRecord[]) || [];
    },
    enabled: !!organizationId,
  });

  // Calculate rollforward for a specific fiscal year (without saving)
  const calculateRollforward = async (
    fiscalYear: number,
    fiscalYearStart: string,
    fiscalYearEnd: string
  ): Promise<RollforwardData | null> => {
    if (!organizationId) return null;

    const { data, error } = await supabase.rpc('calculate_retained_earnings_rollforward', {
      p_organization_id: organizationId,
      p_fiscal_year: fiscalYear,
      p_fiscal_year_start: fiscalYearStart,
      p_fiscal_year_end: fiscalYearEnd,
    });

    if (error) {
      console.error('Error calculating rollforward:', error);
      return null;
    }

    const result = data?.[0];
    if (!result) return null;

    return {
      opening_balance: Number(result.opening_balance) || 0,
      net_income: Number(result.net_income) || 0,
      dividends: Number(result.dividends) || 0,
      prior_period_adjustments: Number(result.prior_period_adjustments) || 0,
      closing_balance: Number(result.closing_balance) || 0,
    };
  };

  // Get RE balance for a specific date
  const getREBalance = async (asOfDate: string): Promise<number> => {
    if (!organizationId) return 0;

    const { data, error } = await supabase.rpc('get_retained_earnings_balance', {
      p_organization_id: organizationId,
      p_as_of_date: asOfDate,
    });

    if (error) {
      console.error('Error getting RE balance:', error);
      return 0;
    }

    return Number(data) || 0;
  };

  // Validate continuity across all fiscal years
  const validateContinuity = async (): Promise<ContinuityCheck[]> => {
    if (!organizationId) return [];

    const { data, error } = await supabase.rpc('validate_retained_earnings_continuity', {
      p_organization_id: organizationId,
    });

    if (error) {
      console.error('Error validating continuity:', error);
      return [];
    }

    return (data as ContinuityCheck[]) || [];
  };

  // Record rollforward manually (usually auto-triggered by fiscal year close)
  const recordRollforwardMutation = useMutation({
    mutationFn: async (params: {
      fiscalYear: number;
      fiscalYearStart: string;
      fiscalYearEnd: string;
    }): Promise<string | null> => {
      if (!organizationId) throw new Error('No organization selected');

      const { data, error } = await supabase.rpc('record_retained_earnings_rollforward', {
        p_organization_id: organizationId,
        p_fiscal_year: params.fiscalYear,
        p_fiscal_year_start: params.fiscalYearStart,
        p_fiscal_year_end: params.fiscalYearEnd,
      });

      if (error) throw error;
      return data as string | null;
    },
    onSuccess: () => {
      toast.success('Retained earnings rollforward recorded');
      queryClient.invalidateQueries({ queryKey: ['retained-earnings-rollforward'] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to record rollforward: ${error.message}`);
    },
  });

  // Check if RE continuity is maintained
  const hasContinuityIssues = rollforwardHistoryQuery.data?.length 
    ? rollforwardHistoryQuery.data.some((record, index, arr) => {
        if (index === 0) return false;
        const prevRecord = arr[index - 1];
        return Math.abs(record.opening_balance - prevRecord.closing_balance) > 0.01;
      })
    : false;

  return {
    rollforwardHistory: rollforwardHistoryQuery.data || [],
    isLoading: rollforwardHistoryQuery.isLoading,
    hasContinuityIssues,
    calculateRollforward,
    getREBalance,
    validateContinuity,
    recordRollforward: recordRollforwardMutation.mutate,
    isRecording: recordRollforwardMutation.isPending,
    refetch: rollforwardHistoryQuery.refetch,
  };
}
