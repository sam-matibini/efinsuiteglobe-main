/**
 * ============================================================================
 * COMPARATIVE FINANCIAL REPORTS HOOK - MULTI-PERIOD DATA FETCHING
 * ============================================================================
 * 
 * This hook fetches financial data for multiple comparison periods in parallel,
 * enabling comparative financial statements (Balance Sheet, Income Statement,
 * Cash Flow, Changes in Equity) with prior period/year comparisons.
 * 
 * GAAP COMPLIANCE:
 * - Comparative statements are required under ASPE Section 1400
 * - Minimum one prior period for public companies
 * - Ensures consistent calculation methodology across all periods
 * 
 * ============================================================================
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from './useOrganization';
import { getFiscalYearForDate, getFiscalYearStart } from '@/lib/fiscalYearUtils';

interface ComparativePeriod {
  label: string;
  startDate: Date;
  endDate: Date;
}

interface AccountBalance {
  id: string;
  code: string;
  name: string;
  account_type: string;
  normal_balance: string;
  is_header: boolean;
  is_current: boolean;  // Whether the account is current or non-current (for Balance Sheet classification)
  parent_id: string | null;
  opening_balance: number;
  current_balance: number;
  calculated_balance: number;
  ytd_balance: number;
}

interface PeriodData {
  period: ComparativePeriod;
  balances: AccountBalance[];
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  netIncome: number;        // Period-specific for Income Statement & Cash Flow
  ytdNetIncome: number;     // YTD for Balance Sheet equation
  isBalanced: boolean;
}

/**
 * Formats a Date object to YYYY-MM-DD string in LOCAL timezone.
 */
const formatLocalDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Fetches account balances for a specific date range.
 * Reuses the same calculation logic as useFinancialReports for consistency.
 */
async function fetchPeriodBalances(
  organizationId: string,
  startDate: Date,
  endDate: Date,
  fiscalYearEndMonth: number = 12
): Promise<AccountBalance[]> {
  const startDateStr = formatLocalDate(startDate);
  const endDateStr = formatLocalDate(endDate);

  // Report fiscal year derived from report end date using org's fiscal year setting
  // For September FY end: FY2022 = Oct 1, 2021 to Sep 30, 2022
  const reportFiscalYear = getFiscalYearForDate(endDate, fiscalYearEndMonth);
  const fiscalYearStart = getFiscalYearStart(reportFiscalYear, fiscalYearEndMonth);
  const fiscalYearStartStr = formatLocalDate(fiscalYearStart);

  // For Balance Sheet YTD net income, we need CUMULATIVE earnings from ALL unclosed years.
  // This ensures the accounting equation balances even when prior years haven't been closed.

  // Get all accounts
  const { data: accounts, error: accountsError } = await supabase
    .from('accounts')
    .select('*')
    .eq('organization_id', organizationId)
    .order('code');

  if (accountsError) throw accountsError;
  if (!accounts) return [];

  // Get all posted/reversed journal entries up to the report end date.
  // CRITICAL: Supabase REST has a default 1000-row cap; paginate explicitly so
  // comparative reports don't silently exclude later entries.
  const fetchAllJournalEntries = async () => {
    const pageSize = 1000;
    const all: Array<{ id: string; entry_date: string; reference: string | null }> = [];
    let offset = 0;
    while (true) {
      const { data, error } = await supabase
        .from('journal_entries')
        .select('id, entry_date, reference')
        .eq('organization_id', organizationId)
        .in('status', ['posted', 'reversed'])
        .lte('entry_date', endDateStr)
        .order('id', { ascending: true })
        .range(offset, offset + pageSize - 1);
      if (error) throw error;
      const rows = data ?? [];
      all.push(...rows);
      if (rows.length < pageSize) break;
      offset += pageSize;
    }
    return all;
  };

  const journalEntries = await fetchAllJournalEntries();

  const journalEntryIds = journalEntries?.map(je => je.id) ?? [];
  const entryDateMap = new Map(journalEntries?.map(e => [e.id, e.entry_date]) ?? []);
  
  // Track fiscal year closing entries (CLOSE-YYYY format) to exclude from net income calculations
  // This ensures comparative periods show the actual period P&L, not zeroed-out closed amounts
  const closingEntryIds = new Set(
    journalEntries?.filter(e => e.reference?.startsWith('CLOSE-')).map(e => e.id) ?? []
  );

  // Fetch journal entry lines with pagination
  let journalLines: Array<{ id: string; account_id: string; debit: number; credit: number; base_currency_debit: number | null; base_currency_credit: number | null; journal_entry_id: string }> = [];

  const fetchAllLinesForEntries = async (entryIds: string[]) => {
    const chunkSize = 200;
    const pageSize = 1000;
    const all: typeof journalLines = [];

    for (let i = 0; i < entryIds.length; i += chunkSize) {
      const chunk = entryIds.slice(i, i + chunkSize);
      let offset = 0;

      while (true) {
        const { data, error } = await supabase
          .from('journal_entry_lines')
          .select('id, account_id, debit, credit, base_currency_debit, base_currency_credit, journal_entry_id')
          .in('journal_entry_id', chunk)
          .order('id', { ascending: true })
          .range(offset, offset + pageSize - 1);

        if (error) throw error;
        const rows = data ?? [];
        all.push(...rows);

        if (rows.length < pageSize) break;
        offset += pageSize;
      }
    }

    return all;
  };

  if (journalEntryIds.length > 0) {
    journalLines = await fetchAllLinesForEntries(journalEntryIds);
  }

  // ----------------------------------------------------------------------
  // Retained Earnings rollforward (reporting-layer computation)
  // Calculate opening RE for THIS period's fiscal year (NOT the main report year).
  // This ensures comparative years correctly show their own opening RE.
  // ----------------------------------------------------------------------
  let retainedEarningsOpeningCents: number | null = null;
  try {
    const { data: openingRE, error: openingREError } = await supabase.rpc(
      'calculate_opening_retained_earnings',
      {
        p_organization_id: organizationId,
        p_fiscal_year: reportFiscalYear, // reportFiscalYear is derived from endDateStr (this period)
      }
    );
    if (openingREError) throw openingREError;
    retainedEarningsOpeningCents = Math.round((Number(openingRE) || 0) * 100);
  } catch {
    retainedEarningsOpeningCents = null;
  }

  const isPermanentAccount = (type: string) => 
    ['asset', 'liability', 'equity'].includes(type);

  // Check if we should include opening balances
  const allEntryDates = journalLines
    .map(l => entryDateMap.get(l.journal_entry_id))
    .filter((d): d is string => !!d);
  
  const earliestTransactionDate = allEntryDates.length > 0
    ? allEntryDates.sort()[0]
    : null;
  
  const shouldIncludeOpeningBalance = earliestTransactionDate
    ? endDateStr >= earliestTransactionDate
    : false;

  // Use integer cents for precision
  const toCents = (n: number) => Math.round(n * 100);
  const fromCents = (n: number) => n / 100;

  // Calculate balances for each account
  const balances: AccountBalance[] = accounts.map(account => {
    const accountLines = journalLines.filter(l => l.account_id === account.id);
    
    let calculatedBalanceCents = 0;
    let periodOpeningBalanceCents = 0;
    let ytdBalanceCents = 0;

    if (isPermanentAccount(account.account_type)) {
      const baseOpeningCents = shouldIncludeOpeningBalance 
        ? toCents(Number(account.opening_balance) || 0)
        : 0;
      
      // Calculate period opening balance (all transactions BEFORE period start)
      periodOpeningBalanceCents = baseOpeningCents;
      for (const line of accountLines) {
        const entryDate = entryDateMap.get(line.journal_entry_id);
        if (!entryDate) continue;
        
        if (entryDate < startDateStr) {
          const debitCents = toCents(line.base_currency_debit ?? line.debit ?? 0);
          const creditCents = toCents(line.base_currency_credit ?? line.credit ?? 0);
          if (account.normal_balance === 'debit') {
            periodOpeningBalanceCents += debitCents - creditCents;
          } else {
            periodOpeningBalanceCents += creditCents - debitCents;
          }
        }
      }
      
      const isRetainedEarningsAccount = account.code?.startsWith('3-00-201') || 
        account.name?.toLowerCase().includes('retained earnings');

      if (isRetainedEarningsAccount && retainedEarningsOpeningCents !== null) {
        // New rollforward behavior:
        // Start RE at Opening RE for the fiscal year, then add ONLY current-year
        // direct RE postings (adjustments/dividends), excluding same-year CLOSE-*.
        periodOpeningBalanceCents = retainedEarningsOpeningCents;
        calculatedBalanceCents = retainedEarningsOpeningCents;

        for (const line of accountLines) {
          const entryDate = entryDateMap.get(line.journal_entry_id);
          if (!entryDate) continue;

          // Exclude CLOSE-YYYY for the report fiscal year
          if (closingEntryIds.has(line.journal_entry_id)) {
            const closingEntry = journalEntries?.find(je => je.id === line.journal_entry_id);
            const closingYear = closingEntry?.reference?.match(/CLOSE-(\d{4})/)?.[1];
            if (closingYear === String(reportFiscalYear)) continue;
          }

          // Only apply current fiscal year's RE movements
          if (entryDate < fiscalYearStartStr || entryDate > endDateStr) continue;

          const debitCents = toCents(line.base_currency_debit ?? line.debit ?? 0);
          const creditCents = toCents(line.base_currency_credit ?? line.credit ?? 0);

          // Period opening: include movements from fiscal year start up to period start
          if (entryDate < startDateStr) {
            if (account.normal_balance === 'debit') {
              periodOpeningBalanceCents += debitCents - creditCents;
            } else {
              periodOpeningBalanceCents += creditCents - debitCents;
            }
          }

          // Closing: include movements from fiscal year start up to report end
          if (account.normal_balance === 'debit') {
            calculatedBalanceCents += debitCents - creditCents;
          } else {
            calculatedBalanceCents += creditCents - debitCents;
          }
        }
      } else {
        // Legacy behavior: derive RE purely from journal lines
        calculatedBalanceCents = baseOpeningCents;
        for (const line of accountLines) {
          const entryDate = entryDateMap.get(line.journal_entry_id);
          if (!entryDate) continue;
          
          if (isRetainedEarningsAccount && closingEntryIds.has(line.journal_entry_id)) {
            const closingEntry = journalEntries?.find(je => je.id === line.journal_entry_id);
            const closingYear = closingEntry?.reference?.match(/CLOSE-(\d{4})/)?.[1];
            const reportYear = endDateStr.substring(0, 4);
            if (closingYear === reportYear) continue;
          }
          
          if (entryDate <= endDateStr) {
            const debitCents = toCents(line.base_currency_debit ?? line.debit ?? 0);
            const creditCents = toCents(line.base_currency_credit ?? line.credit ?? 0);
            if (account.normal_balance === 'debit') {
              calculatedBalanceCents += debitCents - creditCents;
            } else {
              calculatedBalanceCents += creditCents - debitCents;
            }
          }
        }
      }
      
      ytdBalanceCents = calculatedBalanceCents;
    } else {
      // TEMPORARY ACCOUNTS: Activity within the date range only
      // CRITICAL: Exclude fiscal year closing entries (CLOSE-*) from net income calculations
      periodOpeningBalanceCents = 0;
      
      for (const line of accountLines) {
        const entryDate = entryDateMap.get(line.journal_entry_id);
        if (!entryDate) continue;
        
        // Skip closing entries - they zero out temporary accounts but we want to show actual activity
        if (closingEntryIds.has(line.journal_entry_id)) continue;
        
        if (entryDate >= startDateStr && entryDate <= endDateStr) {
          const debitCents = toCents(line.base_currency_debit ?? line.debit ?? 0);
          const creditCents = toCents(line.base_currency_credit ?? line.credit ?? 0);
          if (account.normal_balance === 'debit') {
            calculatedBalanceCents += debitCents - creditCents;
          } else {
            calculatedBalanceCents += creditCents - debitCents;
          }
        }
      }
      
      // Balance Sheet earnings component for equation validation.
      for (const line of accountLines) {
        const entryDate = entryDateMap.get(line.journal_entry_id);
        if (!entryDate) continue;

        if (entryDate <= endDateStr) {
          const debitCents = toCents(line.base_currency_debit ?? line.debit ?? 0);
          const creditCents = toCents(line.base_currency_credit ?? line.credit ?? 0);
          if (account.normal_balance === 'debit') {
            ytdBalanceCents += debitCents - creditCents;
          } else {
            ytdBalanceCents += creditCents - debitCents;
          }
        }
      }
    }

    return {
      id: account.id,
      code: account.code,
      name: account.name,
      account_type: account.account_type,
      normal_balance: account.normal_balance,
      is_header: account.is_header,
      is_current: account.is_current ?? true, // Default to current if not specified
      parent_id: account.parent_id,
      opening_balance: fromCents(periodOpeningBalanceCents),
      current_balance: account.current_balance || 0,
      calculated_balance: fromCents(calculatedBalanceCents),
      ytd_balance: fromCents(ytdBalanceCents),
      cash_flow_category: account.cash_flow_category,
    };
  });

  return balances;
}

/**
 * ============================================================================
 * COMPARATIVE TOTALS - PURE FORMULA APPROACH (ASPE/GAAP COMPLIANT)
 * ============================================================================
 * 
 * Uses the same pure formula logic as the main Balance Sheet:
 * - All amounts derive from journal entries
 * - No static value additions or manipulations
 * - Year-to-year continuity is maintained via proper journal entries
 * ============================================================================
 */
function calculateTotals(balances: AccountBalance[]) {
  const toCents = (n: number) => Math.round(n * 100);
  const fromCents = (n: number) => n / 100;

  const assets = balances.filter(a => a.account_type === 'asset' && !a.is_header);
  const liabilities = balances.filter(a => a.account_type === 'liability' && !a.is_header);
  
  // PURE FORMULA: Include ALL equity accounts as-is from the database
  const equity = balances.filter(a => a.account_type === 'equity' && !a.is_header);
  
  const incomeAccounts = balances.filter(a => a.account_type === 'income' && !a.is_header);
  const expenseAccounts = balances.filter(a => a.account_type === 'expense' && !a.is_header);

  const totalAssetsCents = assets.reduce((sum, a) => {
    const sign = a.normal_balance === 'debit' ? 1 : -1;
    return sum + toCents(a.calculated_balance) * sign;
  }, 0);

  const totalLiabilitiesCents = liabilities.reduce((sum, a) => {
    const sign = a.normal_balance === 'credit' ? 1 : -1;
    return sum + toCents(a.calculated_balance) * sign;
  }, 0);

  // PURE FORMULA: Include ALL equity accounts as recorded in the database
  const totalEquityCents = equity.reduce((sum, a) => {
    const sign = a.normal_balance === 'credit' ? 1 : -1;
    return sum + toCents(a.calculated_balance) * sign;
  }, 0);

  /**
   * CONTRA-ACCOUNT HANDLING (GAAP/ASPE Compliant)
   * ==============================================
   * Income accounts can have different normal_balance values:
   * - Credit-normal (Sales Revenue): ADD to total revenue
   * - Debit-normal (Sales Discounts, Sales Returns): SUBTRACT from revenue
   * 
   * Similarly for expense accounts:
   * - Debit-normal (most expenses): ADD to total expenses
   * - Credit-normal (Purchase Discounts): SUBTRACT from expenses
   * 
   * Net Income = Net Revenue - Net Expenses
   */
  
  // Period Net Income: Use calculated_balance for Income Statement & Cash Flow consistency
  const periodRevenueCents = incomeAccounts.reduce((sum, a) => {
    const sign = a.normal_balance === 'credit' ? 1 : -1;
    return sum + toCents(a.calculated_balance || 0) * sign;
  }, 0);
  const periodExpensesCents = expenseAccounts.reduce((sum, a) => {
    const sign = a.normal_balance === 'debit' ? 1 : -1;
    return sum + toCents(a.calculated_balance || 0) * sign;
  }, 0);
  const netIncomeCents = periodRevenueCents - periodExpensesCents;

  // YTD Net Income: Use ytd_balance for Balance Sheet equation validation
  const ytdRevenueCents = incomeAccounts.reduce((sum, a) => {
    const sign = a.normal_balance === 'credit' ? 1 : -1;
    return sum + toCents(a.ytd_balance || 0) * sign;
  }, 0);
  const ytdExpensesCents = expenseAccounts.reduce((sum, a) => {
    const sign = a.normal_balance === 'debit' ? 1 : -1;
    return sum + toCents(a.ytd_balance || 0) * sign;
  }, 0);
  const ytdNetIncomeCents = ytdRevenueCents - ytdExpensesCents;

  // Balance check uses YTD net income to properly validate the accounting equation
  // PURE FORMULA: totalEquityCents includes all equity accounts from database
  const differenceCents = Math.abs(totalAssetsCents - totalLiabilitiesCents - totalEquityCents - ytdNetIncomeCents);

  return {
    totalAssets: fromCents(totalAssetsCents),
    totalLiabilities: fromCents(totalLiabilitiesCents),
    totalEquity: fromCents(totalEquityCents),
    netIncome: fromCents(netIncomeCents), // Period-specific for Income Statement & Cash Flow
    ytdNetIncome: fromCents(ytdNetIncomeCents), // YTD for Balance Sheet equation
    isBalanced: differenceCents < 1,
  };
}

/**
 * Hook to fetch comparative financial data for multiple periods
 */
export function useComparativeFinancialReports(
  currentPeriod: { startDate: Date; endDate: Date },
  comparisonPeriods: ComparativePeriod[]
) {
  const { organization: currentOrganization } = useCurrentOrganization();

  const allPeriods = [
    { label: 'Current', startDate: currentPeriod.startDate, endDate: currentPeriod.endDate },
    ...comparisonPeriods
  ];

  const query = useQuery({
    queryKey: [
      'comparative-financial-reports',
      currentOrganization?.id,
      currentOrganization?.fiscal_year_end_month ?? 12,
      formatLocalDate(currentPeriod.startDate),
      formatLocalDate(currentPeriod.endDate),
      comparisonPeriods.map(p => `${formatLocalDate(p.startDate)}-${formatLocalDate(p.endDate)}`).join(',')
    ],
    queryFn: async (): Promise<PeriodData[]> => {
      if (!currentOrganization?.id) return [];

      // Get organization's fiscal year end month (default to December/calendar year)
      const fiscalYearEndMonth = currentOrganization.fiscal_year_end_month ?? 12;

      // Fetch all periods in parallel
      const results = await Promise.all(
        allPeriods.map(async (period) => {
          const balances = await fetchPeriodBalances(
            currentOrganization.id,
            period.startDate,
            period.endDate,
            fiscalYearEndMonth
          );
          const totals = calculateTotals(balances);
          return {
            period,
            balances,
            ...totals,
          };
        })
      );

      return results;
    },
    enabled: !!currentOrganization?.id,
    staleTime: 30000, // Cache for 30 seconds
  });

  /**
   * Get comparative balance for a specific account across all periods
   */
  const getAccountComparativeBalances = (accountId: string): number[] => {
    if (!query.data) return [];
    return query.data.map(pd => {
      const account = pd.balances.find(a => a.id === accountId);
      return account?.calculated_balance ?? 0;
    });
  };

  /**
   * Get comparative balances for accounts by type
   */
  const getAccountsByType = (accountType: string): Array<AccountBalance & { comparativeBalances: number[] }> => {
    if (!query.data || query.data.length === 0) return [];
    
    const currentPeriodData = query.data[0];
    const accounts = currentPeriodData.balances.filter(a => a.account_type === accountType && !a.is_header);
    
    return accounts.map(account => ({
      ...account,
      comparativeBalances: query.data!.slice(1).map(pd => {
        const compAccount = pd.balances.find(a => a.id === account.id);
        return compAccount?.calculated_balance ?? 0;
      }),
    }));
  };

  /**
   * Get comparative totals for all periods
   */
  const getComparativeTotals = () => {
    if (!query.data) return [];
    return query.data.map(pd => ({
      label: pd.period.label,
      totalAssets: pd.totalAssets,
      totalLiabilities: pd.totalLiabilities,
      totalEquity: pd.totalEquity,
      netIncome: pd.netIncome,           // Period-specific for Income Statement & Cash Flow
      ytdNetIncome: pd.ytdNetIncome,     // YTD for Balance Sheet equation
      isBalanced: pd.isBalanced,
    }));
  };

  /**
   * Get income statement data with comparatives
   */
  const getComparativeIncomeStatement = () => {
    if (!query.data) return null;

    const codeStartsWith = (code: string, prefix: string) => code.startsWith(prefix);
    const toCents = (n: number) => Math.round(n * 100);
    const fromCents = (n: number) => n / 100;

    return query.data.map(pd => {
      const income = pd.balances.filter(a => 
        a.account_type === 'income' && !a.is_header &&
        (codeStartsWith(a.code, '4') || (!codeStartsWith(a.code, '7') && !codeStartsWith(a.code, '8') && !codeStartsWith(a.code, '9')))
      );
      const otherIncome = pd.balances.filter(a => 
        a.account_type === 'income' && !a.is_header && (codeStartsWith(a.code, '7') || codeStartsWith(a.code, '8'))
      );
      const cogs = pd.balances.filter(a => 
        a.account_type === 'expense' && !a.is_header && codeStartsWith(a.code, '5')
      );
      const expenses = pd.balances.filter(a => 
        a.account_type === 'expense' && !a.is_header && codeStartsWith(a.code, '6')
      );
      const nonOperatingExpenses = pd.balances.filter(a => 
        a.account_type === 'expense' && !a.is_header &&
        (codeStartsWith(a.code, '7') || codeStartsWith(a.code, '8'))
      );
      const incomeTaxExpenses = pd.balances.filter(a => 
        a.account_type === 'expense' && !a.is_header && codeStartsWith(a.code, '9')
      );
      const otherExpenses = [...nonOperatingExpenses, ...incomeTaxExpenses];

      // CONTRA-ACCOUNT HANDLING: Credit-normal income adds, debit-normal (discounts/returns) subtracts
      const totalRevenueCents = income.reduce((sum, a) => {
        const sign = a.normal_balance === 'credit' ? 1 : -1;
        return sum + toCents(a.calculated_balance) * sign;
      }, 0);
      const totalOtherIncomeCents = otherIncome.reduce((sum, a) => {
        const sign = a.normal_balance === 'credit' ? 1 : -1;
        return sum + toCents(a.calculated_balance) * sign;
      }, 0);
      // Expense accounts: Debit-normal adds, credit-normal (purchase discounts) subtracts
      const totalCOGSCents = cogs.reduce((sum, a) => {
        const sign = a.normal_balance === 'debit' ? 1 : -1;
        return sum + toCents(a.calculated_balance) * sign;
      }, 0);
      const totalExpensesCents = expenses.reduce((sum, a) => {
        const sign = a.normal_balance === 'debit' ? 1 : -1;
        return sum + toCents(a.calculated_balance) * sign;
      }, 0);
      const totalNonOperatingExpensesCents = nonOperatingExpenses.reduce((sum, a) => {
        const sign = a.normal_balance === 'debit' ? 1 : -1;
        return sum + toCents(a.calculated_balance) * sign;
      }, 0);
      const totalIncomeTaxCents = incomeTaxExpenses.reduce((sum, a) => {
        const sign = a.normal_balance === 'debit' ? 1 : -1;
        return sum + toCents(a.calculated_balance) * sign;
      }, 0);
      const totalOtherExpensesCents = totalNonOperatingExpensesCents + totalIncomeTaxCents;
      
      const grossProfitCents = totalRevenueCents - totalCOGSCents;
      const operatingIncomeCents = grossProfitCents - totalExpensesCents;
      const incomeBeforeTaxCents = operatingIncomeCents + totalOtherIncomeCents - totalNonOperatingExpensesCents;
      const netIncomeCents = incomeBeforeTaxCents - totalIncomeTaxCents;

      return {
        label: pd.period.label,
        income,
        otherIncome,
        cogs,
        expenses,
        otherExpenses,
        nonOperatingExpenses,
        incomeTaxExpenses,
        totalRevenue: fromCents(totalRevenueCents),
        totalOtherIncome: fromCents(totalOtherIncomeCents),
        totalCOGS: fromCents(totalCOGSCents),
        totalExpenses: fromCents(totalExpensesCents),
        totalOtherExpenses: fromCents(totalOtherExpensesCents),
        totalNonOperatingExpenses: fromCents(totalNonOperatingExpensesCents),
        totalIncomeTax: fromCents(totalIncomeTaxCents),
        grossProfit: fromCents(grossProfitCents),
        operatingIncome: fromCents(operatingIncomeCents),
        incomeBeforeTax: fromCents(incomeBeforeTaxCents),
        netIncome: fromCents(netIncomeCents),
      };
    });
  };

  return {
    isLoading: query.isLoading,
    error: query.error,
    data: query.data,
    refetch: query.refetch,
    getAccountComparativeBalances,
    getAccountsByType,
    getComparativeTotals,
    getComparativeIncomeStatement,
    periodCount: allPeriods.length,
  };
}
