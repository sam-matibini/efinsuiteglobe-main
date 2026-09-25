import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { enforceRetainedEarningsContinuity } from '@/lib/retainedEarningsRollforward';

/**
 * ============================================================================
 * STATEMENT OF RETAINED EARNINGS - ASPE/IFRS/CRA Schedule 100 Compliant
 * ============================================================================
 * 
 * This hook calculates the Statement of Retained Earnings (Deficit) for display
 * below the Balance Sheet per CRA GIFI requirements:
 * 
 * GIFI 3660: Opening balance
 * GIFI 3680: Net income (loss)
 * GIFI 3849: Closing balance
 * 
 * Formula:
 * Closing RE = Opening RE + Net Income - Dividends + Adjustments
 * 
 * For Year 1: Opening = 0 (first year of operations)
 * For Year N: Opening = Closing of Year N-1
 */

export interface RetainedEarningsStatementData {
  openingBalance: number;
  netIncomeLoss: number;
  otherAdditions: number;
  dividendsDeclared: number;
  otherDeductions: number;
  closingBalance: number;
}

export interface ComparativeREStatement {
  label: string;
  fiscalYear: number;
  data: RetainedEarningsStatementData;
}

/**
 * Calculate Statement of Retained Earnings for current and comparative periods
 */
export function useRetainedEarningsStatement(
  currentPeriod: { startDate: Date; endDate: Date },
  comparisonPeriods: { label: string; startDate: Date; endDate: Date }[] = []
) {
  const { organization } = useCurrentOrganization();

  // Helper to format date as YYYY-MM-DD
  const formatDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const fetchREStatement = async (
    orgId: string,
    startDate: Date,
    endDate: Date
  ): Promise<RetainedEarningsStatementData> => {
    const { data, error } = await supabase.rpc('calculate_retained_earnings_statement', {
      p_organization_id: orgId,
      p_fiscal_year_start: formatDate(startDate),
      p_fiscal_year_end: formatDate(endDate),
    });

    if (error) {
      console.error('Error calculating RE statement:', error);
      // Return zeros if RPC fails (graceful degradation)
      return {
        openingBalance: 0,
        netIncomeLoss: 0,
        otherAdditions: 0,
        dividendsDeclared: 0,
        otherDeductions: 0,
        closingBalance: 0,
      };
    }

    const row = data?.[0];
    return {
      openingBalance: Number(row?.opening_balance ?? 0),
      netIncomeLoss: Number(row?.net_income_loss ?? 0),
      otherAdditions: Number(row?.other_additions ?? 0),
      dividendsDeclared: Number(row?.dividends_declared ?? 0),
      otherDeductions: Number(row?.other_deductions ?? 0),
      closingBalance: Number(row?.closing_balance ?? 0),
    };
  };

  // Query for all periods (current + comparatives)
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: [
      'retained-earnings-statement',
      organization?.id,
      currentPeriod.startDate.toISOString(),
      currentPeriod.endDate.toISOString(),
      comparisonPeriods.map(p => `${p.startDate.toISOString()}-${p.endDate.toISOString()}`).join(','),
    ],
    queryFn: async () => {
      if (!organization?.id) return null;

      // Fetch current period
      const currentData = await fetchREStatement(
        organization.id,
        currentPeriod.startDate,
        currentPeriod.endDate
      );

      // Fetch all comparison periods in parallel
      const comparativePromises = comparisonPeriods.map(async (period) => {
        const data = await fetchREStatement(
          organization.id,
          period.startDate,
          period.endDate
        );
        return {
          label: period.label,
          fiscalYear: period.endDate.getFullYear(),
          data,
        };
      });

      const comparativeData = await Promise.all(comparativePromises);

      const currentEntry = {
        key: 'current',
        label: `${currentPeriod.endDate.getFullYear()}`,
        fiscalYear: currentPeriod.endDate.getFullYear(),
        startDate: currentPeriod.startDate,
        endDate: currentPeriod.endDate,
        data: currentData,
      };

      const comparativeEntries = comparativeData.map((period, index) => ({
        key: `comp-${index}`,
        label: period.label,
        fiscalYear: period.fiscalYear,
        startDate: comparisonPeriods[index].startDate,
        endDate: comparisonPeriods[index].endDate,
        data: period.data,
      }));

      // Opening RE (Year N) must equal Closing RE (Year N-1) on comparative
      // statements. Reclassify any leftover gap as a prior-period adjustment.
      const enforced = enforceRetainedEarningsContinuity([
        currentEntry,
        ...comparativeEntries,
      ]);
      const enforcedCurrent = enforced.find((row) => row.key === 'current') ?? currentEntry;
      const enforcedComparatives = comparativeEntries.map((entry) => {
        const next = enforced.find((row) => row.key === entry.key);
        return {
          label: entry.label,
          fiscalYear: entry.fiscalYear,
          data: next?.data ?? entry.data,
        };
      });

      return {
        current: {
          label: enforcedCurrent.label,
          fiscalYear: enforcedCurrent.fiscalYear,
          data: enforcedCurrent.data,
        },
        comparatives: enforcedComparatives,
      };
    },
    enabled: !!organization?.id,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  return {
    currentStatement: data?.current,
    comparativeStatements: data?.comparatives ?? [],
    isLoading,
    error,
    refetch,
  };
}
