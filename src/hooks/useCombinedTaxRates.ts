/**
 * Hook for fetching combined tax rates view from database
 * 
 * Uses the combined_tax_rates view which provides:
 * - Per-jurisdiction tax model (GST_ONLY, GST_PST, HST)
 * - Separate GST, PST, HST rates
 * - Combined rate for display
 * - Breakdown JSON for UI
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { TaxModel } from '@/lib/splitTaxCalculator';

export interface CombinedTaxRate {
  jurisdictionId: string;
  jurisdictionCode: string;
  jurisdictionName: string;
  taxModel: TaxModel;
  requiresSeparatePstAccounting: boolean;
  countryCode: string;
  gstRate: number;
  pstRate: number;
  hstRate: number;
  combinedRate: number;
  breakdown: Array<{
    code: string;
    rate: number;
    authority: string;
  }>;
}

/**
 * Fetch combined tax rates for Canadian jurisdictions
 */
export function useCombinedTaxRates() {
  return useQuery({
    queryKey: ['combined-tax-rates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('combined_tax_rates')
        .select('*');
      
      if (error) throw error;
      
      return (data || []).map((row: any): CombinedTaxRate => ({
        jurisdictionId: row.jurisdiction_id,
        jurisdictionCode: row.jurisdiction_code,
        jurisdictionName: row.jurisdiction_name,
        taxModel: row.tax_model as TaxModel,
        requiresSeparatePstAccounting: row.requires_separate_pst_accounting,
        countryCode: row.country_code,
        gstRate: parseFloat(row.gst_rate || 0),
        pstRate: parseFloat(row.pst_rate || 0),
        hstRate: parseFloat(row.hst_rate || 0),
        combinedRate: parseFloat(row.combined_rate || 0),
        breakdown: row.breakdown_json || [],
      }));
    },
  });
}

/**
 * Get tax rate for a specific jurisdiction
 */
export function useTaxRateForJurisdiction(jurisdictionCode?: string) {
  const { data: allRates, isLoading, error } = useCombinedTaxRates();
  
  const rate = allRates?.find(r => r.jurisdictionCode === jurisdictionCode) || null;
  
  return {
    data: rate,
    isLoading,
    error,
  };
}

/**
 * Hook to calculate split taxes using the database function
 */
export function useCalculateSplitTaxes() {
  return async (
    amount: number,
    jurisdictionCode: string,
    isInclusive: boolean = false
  ) => {
    const { data, error } = await supabase.rpc('calculate_split_taxes', {
      p_amount: amount,
      p_jurisdiction_code: jurisdictionCode,
      p_is_inclusive: isInclusive,
    });
    
    if (error) throw error;
    return data;
  };
}

/**
 * Hook for organization's tax display preference
 */
export function useOrganizationTaxDisplayPreference(organizationId?: string) {
  return useQuery({
    queryKey: ['org-tax-display-pref', organizationId],
    queryFn: async () => {
      if (!organizationId) return { showCombined: true };
      
      const { data, error } = await supabase
        .from('organizations')
        .select('show_combined_tax_display')
        .eq('id', organizationId)
        .single();
      
      if (error) throw error;
      return { showCombined: data?.show_combined_tax_display ?? true };
    },
    enabled: !!organizationId,
  });
}
