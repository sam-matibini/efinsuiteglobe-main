import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from '@/hooks/useOrganization';

/**
 * Zoho Books Style Statement of Changes in Equity
 * 
 * Columns: Description | Share Capital ($) | Retained Earnings ($) | Total Equity ($)
 * 
 * For each year, rows:
 *   - Balance at January 1, YYYY
 *   - Profit/Loss for the year YYYY
 *   - Owner's Investment/Contribution
 *   - Drawings/Dividends Paid
 *   - Balance at December 31, YYYY
 * 
 * CRITICAL FORMULA (per memory):
 *   Total Equity = Common Stock + Opening Retained Earnings + Current Year Earnings
 *   Opening RE for Year Y = Prior Year Closing RE = Prior Opening RE + Prior Net Income
 * 
 * INTEGRATION:
 *   - Share Capital from Common Stock account (equity_category = 'COMMON_STOCK')
 *   - Retained Earnings from get_retained_earnings_rollforward_series (proper roll-forward)
 *   - Links to GL, TB, Balance Sheet, Income Statement
 */

export interface ZohoEquityRow {
  id: string;
  label: string;
  shareCapital: number;
  retainedEarnings: number;
  totalEquity: number;
  isHeader?: boolean;
  isTotal?: boolean;
  isSubtotal?: boolean;
  indent?: number;
  year?: number;
}

interface RollforwardData {
  fiscal_year: number;
  opening_re: number;
  net_income: number;
  dividends: number;
  closing_re: number;
}

interface GLEquityData {
  fiscal_year: number;
  share_capital_opening: number;
  share_capital_contributions: number;
  share_capital_closing: number;
  retained_earnings_opening: number;
  net_income: number;
  distributions: number;
  retained_earnings_closing: number;
}

export function useZohoEquityData(years: number[]) {
  const { organization } = useCurrentOrganization();
  const organizationId = organization?.id;

  // Primary query: Get proper retained earnings rollforward (handles year-over-year continuity)
  const rollforwardQuery = useQuery({
    queryKey: ['re-rollforward', organizationId, years],
    queryFn: async () => {
      if (!organizationId || years.length === 0) return [];

      const startYear = Math.min(...years);
      const endYear = Math.max(...years);

      const { data, error } = await supabase.rpc('get_retained_earnings_rollforward_series', {
        p_organization_id: organizationId,
        p_start_year: startYear,
        p_end_year: endYear,
      });

      if (error) throw error;
      return (data || []) as RollforwardData[];
    },
    enabled: !!organizationId && years.length > 0,
  });

  // Secondary query: Get Share Capital (Common Stock) from GL
  const shareCapitalQuery = useQuery({
    queryKey: ['share-capital-data', organizationId, years],
    queryFn: async () => {
      if (!organizationId || years.length === 0) return [];

      const sortedYears = [...years].sort((a, b) => a - b);
      const results: { fiscal_year: number; opening: number; contributions: number; closing: number }[] = [];

      // Get ALL Common Stock / Share Capital accounts (aggregate across multiple)
      let scAccounts: { id: string; opening_balance: number | null }[] = [];
      
      const { data: scByCategory } = await supabase
        .from('accounts')
        .select('id, opening_balance')
        .eq('organization_id', organizationId)
        .eq('equity_category', 'COMMON_STOCK')
        .eq('is_header', false);
      
      scAccounts = scByCategory || [];
      
      // Fallback: match by name if equity_category not set
      if (scAccounts.length === 0) {
        const { data: scByName } = await supabase
          .from('accounts')
          .select('id, opening_balance')
          .eq('organization_id', organizationId)
          .eq('account_type', 'equity')
          .eq('is_header', false)
          .or('name.ilike.%common share%,name.ilike.%common stock%,name.ilike.%share capital%');
        
        scAccounts = scByName || [];
      }

      if (scAccounts.length === 0) {
        return sortedYears.map(year => ({ fiscal_year: year, opening: 0, contributions: 0, closing: 0 }));
      }

      // Get fiscal year end month for dynamic date boundaries
      const { data: orgData } = await supabase
        .from('organizations')
        .select('fiscal_year_end_month')
        .eq('id', organizationId)
        .single();
      const fyEndMonth = orgData?.fiscal_year_end_month ?? 12;

      for (const year of sortedYears) {
        let fiscalStart: string, fiscalEnd: string;
        if (fyEndMonth === 12) {
          fiscalStart = `${year}-01-01`;
          fiscalEnd = `${year}-12-31`;
        } else {
          const startMonth = String(fyEndMonth + 1).padStart(2, '0');
          fiscalStart = `${year - 1}-${startMonth}-01`;
          const endDate = new Date(year, fyEndMonth + 1, 0); // last day of fyEndMonth+1
          fiscalEnd = `${year}-${String(fyEndMonth).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;
        }

        let totalOpening = 0;
        let totalContributions = 0;

        for (const acct of scAccounts) {
          const { data: openingActivity } = await supabase
            .from('journal_entry_lines')
            .select('debit, credit, journal_entries!inner(entry_date, status)')
            .eq('account_id', acct.id)
            .eq('journal_entries.status', 'posted')
            .lt('journal_entries.entry_date', fiscalStart);

          const opening = (acct.opening_balance || 0) +
            (openingActivity || []).reduce((sum, l) => sum + ((l.credit || 0) - (l.debit || 0)), 0);

          const { data: yearActivity } = await supabase
            .from('journal_entry_lines')
            .select('debit, credit, journal_entries!inner(entry_date, status)')
            .eq('account_id', acct.id)
            .eq('journal_entries.status', 'posted')
            .gte('journal_entries.entry_date', fiscalStart)
            .lte('journal_entries.entry_date', fiscalEnd);

          const contributions = (yearActivity || []).reduce((sum, l) => sum + ((l.credit || 0) - (l.debit || 0)), 0);

          totalOpening += opening;
          totalContributions += contributions;
        }

        results.push({
          fiscal_year: year,
          opening: totalOpening,
          contributions: totalContributions,
          closing: totalOpening + totalContributions,
        });
      }

      return results;
    },
    enabled: !!organizationId && years.length > 0,
  });

  /**
   * Build Zoho-style rows for the Statement of Changes in Equity
   * Uses rollforward series for RE (proper year-over-year continuity)
   * Uses GL for Share Capital (Common Stock)
   */
  const buildZohoRows = (): ZohoEquityRow[] => {
    const rows: ZohoEquityRow[] = [];
    const rollforwardData = rollforwardQuery.data || [];
    const shareCapitalData = shareCapitalQuery.data || [];
    const sortedYears = [...years].sort((a, b) => a - b);

    sortedYears.forEach((year, yearIndex) => {
      const reData = rollforwardData.find(d => d.fiscal_year === year);
      const scData = shareCapitalData.find(d => d.fiscal_year === year);

      // Share Capital values
      const scOpening = scData?.opening ?? 0;
      const scContributions = scData?.contributions ?? 0;
      const scClosing = scData?.closing ?? 0;
      
      // Retained Earnings values (from proper rollforward)
      const reOpening = reData?.opening_re ?? 0;
      const reNetIncome = reData?.net_income ?? 0;
      const reDistributions = reData?.dividends ?? 0;
      const reClosing = reData?.closing_re ?? 0;

      // Opening Balance Row
      rows.push({
        id: `opening-${year}`,
        label: `Balance at January 1, ${year}`,
        shareCapital: scOpening,
        retainedEarnings: reOpening,
        totalEquity: scOpening + reOpening,
        year,
      });

      // Profit/Loss for the year
      rows.push({
        id: `profit-loss-${year}`,
        label: `Profit/Loss for the year ${year}`,
        shareCapital: 0,
        retainedEarnings: reNetIncome,
        totalEquity: reNetIncome,
        indent: 1,
        year,
      });

      // Owner's Investment/Contribution
      rows.push({
        id: `contributions-${year}`,
        label: `Owner's Investment/Contribution`,
        shareCapital: scContributions,
        retainedEarnings: 0,
        totalEquity: scContributions,
        indent: 1,
        year,
      });

      // Drawings/Dividends Paid
      rows.push({
        id: `distributions-${year}`,
        label: `Drawings/Dividends Paid`,
        shareCapital: 0,
        retainedEarnings: reDistributions !== 0 ? -reDistributions : 0,
        totalEquity: reDistributions !== 0 ? -reDistributions : 0,
        indent: 1,
        year,
      });

      // Closing Balance Row
      rows.push({
        id: `closing-${year}`,
        label: `Balance at December 31, ${year}`,
        shareCapital: scClosing,
        retainedEarnings: reClosing,
        totalEquity: scClosing + reClosing,
        isSubtotal: true,
        year,
      });

      // Add spacing row between years
      if (yearIndex < sortedYears.length - 1) {
        rows.push({
          id: `spacer-${year}`,
          label: '',
          shareCapital: 0,
          retainedEarnings: 0,
          totalEquity: 0,
        });
      }
    });

    return rows;
  };

  // Get final totals for summary cards
  const getTotals = () => {
    const rollforwardData = rollforwardQuery.data || [];
    const shareCapitalData = shareCapitalQuery.data || [];
    const sortedYears = [...years].sort((a, b) => a - b);
    const currentYear = sortedYears.length > 0 ? sortedYears[sortedYears.length - 1] : new Date().getFullYear();
    
    const reData = rollforwardData.find(d => d.fiscal_year === currentYear);
    const scData = shareCapitalData.find(d => d.fiscal_year === currentYear);

    return {
      openingEquity: (scData?.opening ?? 0) + (reData?.opening_re ?? 0),
      closingEquity: (scData?.closing ?? 0) + (reData?.closing_re ?? 0),
      netIncome: reData?.net_income ?? 0,
      distributions: Math.abs(reData?.dividends ?? 0),
      contributions: scData?.contributions ?? 0,
      shareCapital: scData?.closing ?? 0,
      retainedEarnings: reData?.closing_re ?? 0,
    };
  };

  return {
    rows: buildZohoRows(),
    totals: getTotals(),
    isLoading: rollforwardQuery.isLoading || shareCapitalQuery.isLoading,
    error: rollforwardQuery.error || shareCapitalQuery.error,
    refetch: () => {
      rollforwardQuery.refetch();
      shareCapitalQuery.refetch();
    },
    hasData: (rollforwardQuery.data?.length || 0) > 0 || (shareCapitalQuery.data?.length || 0) > 0,
  };
}
