import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from '@/hooks/useOrganization';

export interface ASPEEquityMovement {
  fiscal_year: number;
  equity_category: string;
  movement_type: string;
  amount: number;
  account_name: string;
}

export interface ASPEEquitySummary {
  fiscal_year: number;
  equity_category: string;
  opening_balance: number;
  contributions: number;
  net_income: number;
  distributions: number;
  prior_period_adjustments: number;
  closing_balance: number;
}

export interface ASPEEquityRow {
  id: string;
  label: string;
  amounts: Record<number, number>; // fiscal_year -> amount
  isHeader?: boolean;
  isTotal?: boolean;
  isSubtotal?: boolean;
  indent?: number;
}

/**
 * Fetch ASPE equity data from the database views
 */
export function useASPEEquityData(years: number[]) {
  const { organization } = useCurrentOrganization();
  const organizationId = organization?.id;

  // Fetch detailed movements
  const movementsQuery = useQuery({
    queryKey: ['aspe-equity-movements', organizationId, years],
    queryFn: async () => {
      if (!organizationId || years.length === 0) return [];

      const { data, error } = await supabase
        .from('equity_movements')
        .select(`
          fiscal_year,
          movement_type,
          amount,
          equity_account_id,
          accounts:equity_account_id (
            name,
            equity_category
          )
        `)
        .eq('organization_id', organizationId)
        .in('fiscal_year', years)
        .order('fiscal_year', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!organizationId && years.length > 0,
  });

  // Fetch comparative summary from view
  const summaryQuery = useQuery({
    queryKey: ['aspe-equity-summary', organizationId, years],
    queryFn: async () => {
      if (!organizationId || years.length === 0) return [];

      // Use the RPC function to get ASPE data
      const startYear = Math.min(...years);
      const endYear = Math.max(...years);

      const { data, error } = await supabase.rpc('get_soce_aspe_data', {
        p_organization_id: organizationId,
        p_start_year: startYear,
        p_end_year: endYear,
      });

      if (error) throw error;
      return (data || []) as ASPEEquitySummary[];
    },
    enabled: !!organizationId && years.length > 0,
  });

  /**
   * Build ASPE-formatted rows for the Statement of Changes in Equity
   * Format:
   *   COMMON STOCK
   *     Opening Balance
   *     Contributions/Issuances
   *     Closing Balance
   *   RETAINED EARNINGS
   *     Opening Balance
   *     Net Income
   *     Dividends/Distributions
   *     Closing Balance
   *   TOTAL EQUITY
   */
  const buildASPERows = (): ASPEEquityRow[] => {
    const rows: ASPEEquityRow[] = [];
    const summaryData = summaryQuery.data || [];

    // Track totals for each year
    const yearTotals: Record<number, { opening: number; closing: number }> = {};
    years.forEach(y => {
      yearTotals[y] = { opening: 0, closing: 0 };
    });

    // Define the order of categories - Common Stock first, then Retained Earnings
    const categoryOrder = ['COMMON_STOCK', 'RETAINED_EARNINGS'];
    
    // Get unique categories from data
    const dataCategories = [...new Set(summaryData.map(s => s.equity_category).filter(Boolean))];
    
    // Use defined order, but also include any other categories from data
    const orderedCategories = categoryOrder.filter(c => dataCategories.includes(c));
    const otherCategories = dataCategories.filter(c => !categoryOrder.includes(c));
    const allCategories = [...orderedCategories, ...otherCategories];

    // If no data, still show the structure with zeros
    if (summaryData.length === 0) {
      // Show Common Stock section
      rows.push({
        id: 'header-COMMON_STOCK',
        label: 'COMMON STOCK',
        amounts: {},
        isHeader: true,
      });
      const zeroAmounts: Record<number, number> = {};
      years.forEach(y => { zeroAmounts[y] = 0; });
      rows.push({ id: 'COMMON_STOCK-opening', label: 'Opening Balance', amounts: { ...zeroAmounts }, indent: 1 });
      rows.push({ id: 'COMMON_STOCK-closing', label: 'Closing Balance', amounts: { ...zeroAmounts }, indent: 1, isSubtotal: true });
      rows.push({ id: 'spacer-COMMON_STOCK', label: '', amounts: {} });

      // Show Retained Earnings section
      rows.push({
        id: 'header-RETAINED_EARNINGS',
        label: 'RETAINED EARNINGS',
        amounts: {},
        isHeader: true,
      });
      rows.push({ id: 'RETAINED_EARNINGS-opening', label: 'Opening Balance', amounts: { ...zeroAmounts }, indent: 1 });
      rows.push({ id: 'RETAINED_EARNINGS-net-income', label: 'Net Income', amounts: { ...zeroAmounts }, indent: 1 });
      rows.push({ id: 'RETAINED_EARNINGS-closing', label: 'Closing Balance', amounts: { ...zeroAmounts }, indent: 1, isSubtotal: true });
      rows.push({ id: 'spacer-RETAINED_EARNINGS', label: '', amounts: {} });

      // Total Equity row
      rows.push({
        id: 'total-equity',
        label: 'Total Equity',
        amounts: { ...zeroAmounts },
        isTotal: true,
      });

      return rows;
    }

    allCategories.forEach(category => {
      if (!category) return;

      const categoryData = summaryData.filter(s => s.equity_category === category);
      
      // Category header
      const categoryLabel = category.replace(/_/g, ' ');
      rows.push({
        id: `header-${category}`,
        label: categoryLabel,
        amounts: {},
        isHeader: true,
      });

      // Opening Balance row
      const openingAmounts: Record<number, number> = {};
      years.forEach(y => { openingAmounts[y] = 0; }); // Initialize all years
      categoryData.forEach(d => {
        openingAmounts[d.fiscal_year] = Number(d.opening_balance) || 0;
        yearTotals[d.fiscal_year].opening += Number(d.opening_balance) || 0;
      });
      rows.push({
        id: `${category}-opening`,
        label: 'Opening Balance',
        amounts: openingAmounts,
        indent: 1,
      });

      // Category-specific rows
      if (category === 'RETAINED_EARNINGS') {
        // Net Income row
        const netIncomeAmounts: Record<number, number> = {};
        years.forEach(y => { netIncomeAmounts[y] = 0; });
        categoryData.forEach(d => {
          netIncomeAmounts[d.fiscal_year] = Number(d.net_income) || 0;
        });
        rows.push({
          id: `${category}-net-income`,
          label: 'Net Income',
          amounts: netIncomeAmounts,
          indent: 1,
        });

        // Dividends/Distributions row (always show for RE)
        const distributionAmounts: Record<number, number> = {};
        years.forEach(y => { distributionAmounts[y] = 0; });
        categoryData.forEach(d => {
          distributionAmounts[d.fiscal_year] = Number(d.distributions) || 0;
        });
        if (Object.values(distributionAmounts).some(v => v !== 0)) {
          rows.push({
            id: `${category}-distributions`,
            label: 'Dividends/Drawings',
            amounts: distributionAmounts,
            indent: 1,
          });
        }

        // Prior Period Adjustments (if any)
        const adjAmounts: Record<number, number> = {};
        years.forEach(y => { adjAmounts[y] = 0; });
        categoryData.forEach(d => {
          adjAmounts[d.fiscal_year] = Number(d.prior_period_adjustments) || 0;
        });
        if (Object.values(adjAmounts).some(v => v !== 0)) {
          rows.push({
            id: `${category}-adjustments`,
            label: 'Prior Period Adjustments',
            amounts: adjAmounts,
            indent: 1,
          });
        }
      } else if (category === 'COMMON_STOCK') {
        // Contributions/Share Issuance row
        const contributionAmounts: Record<number, number> = {};
        years.forEach(y => { contributionAmounts[y] = 0; });
        categoryData.forEach(d => {
          contributionAmounts[d.fiscal_year] = Number(d.contributions) || 0;
        });
        if (Object.values(contributionAmounts).some(v => v !== 0)) {
          rows.push({
            id: `${category}-contributions`,
            label: 'Share Issuances',
            amounts: contributionAmounts,
            indent: 1,
          });
        }
      }

      // Closing Balance row (category subtotal)
      const closingAmounts: Record<number, number> = {};
      years.forEach(y => { closingAmounts[y] = 0; });
      categoryData.forEach(d => {
        closingAmounts[d.fiscal_year] = Number(d.closing_balance) || 0;
        yearTotals[d.fiscal_year].closing += Number(d.closing_balance) || 0;
      });
      rows.push({
        id: `${category}-closing`,
        label: 'Closing Balance',
        amounts: closingAmounts,
        indent: 1,
        isSubtotal: true,
      });

      // Empty row for spacing
      rows.push({
        id: `spacer-${category}`,
        label: '',
        amounts: {},
      });
    });

    // Total Equity row
    const totalClosingAmounts: Record<number, number> = {};
    years.forEach(y => {
      totalClosingAmounts[y] = yearTotals[y].closing;
    });
    rows.push({
      id: 'total-equity',
      label: 'Total Equity',
      amounts: totalClosingAmounts,
      isTotal: true,
    });

    return rows;
  };

  return {
    rows: buildASPERows(),
    isLoading: movementsQuery.isLoading || summaryQuery.isLoading,
    error: movementsQuery.error || summaryQuery.error,
    refetch: () => {
      movementsQuery.refetch();
      summaryQuery.refetch();
    },
    hasData: (summaryQuery.data?.length || 0) > 0,
  };
}

/**
 * Populate equity movements for a fiscal year
 */
export function usePopulateEquityMovements() {
  const { organization } = useCurrentOrganization();

  const populate = async (fiscalYear: number) => {
    if (!organization?.id) throw new Error('No organization');

    const { error } = await supabase.rpc('populate_equity_movements', {
      p_organization_id: organization.id,
      p_fiscal_year: fiscalYear,
    });

    if (error) throw error;
  };

  return { populate };
}
