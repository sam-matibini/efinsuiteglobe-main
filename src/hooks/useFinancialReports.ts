/**
 * ============================================================================
 * FINANCIAL REPORTS HOOK - GAAP/ASPE COMPLIANT CALCULATIONS
 * ============================================================================
 * 
 * This hook provides the core financial calculation logic for all financial
 * statements in the system. It follows Canadian GAAP (ASPE) principles and
 * implements double-entry accounting.
 * 
 * CORE PRINCIPLES:
 * ----------------
 * 1. DOUBLE-ENTRY ACCOUNTING: Every transaction affects at least two accounts.
 *    Total Debits must always equal Total Credits.
 * 
 * 2. NORMAL BALANCES:
 *    - Assets: Normal balance is DEBIT (positive balance = debit > credit)
 *    - Liabilities: Normal balance is CREDIT (positive balance = credit > debit)
 *    - Equity: Normal balance is CREDIT (positive balance = credit > debit)
 *    - Income: Normal balance is CREDIT (positive balance = credit > debit)
 *    - Expenses: Normal balance is DEBIT (positive balance = debit > credit)
 *    - COGS: Normal balance is DEBIT (positive balance = debit > credit)
 * 
 * 3. CONTRA ACCOUNTS:
 *    - Accumulated Depreciation is a CONTRA-ASSET (credit normal, reduces assets)
 *    - Owner's Drawings is a CONTRA-EQUITY (debit normal, reduces equity)
 *    - Sales Returns is a CONTRA-REVENUE (debit normal, reduces income)
 * 
 * BALANCE CALCULATION LOGIC:
 * --------------------------
 * For each account, the calculated_balance is normalized based on its normal_balance:
 * - Debit-normal accounts: calculated_balance = Σ(debits) - Σ(credits)
 * - Credit-normal accounts: calculated_balance = Σ(credits) - Σ(debits)
 * 
 * This means a POSITIVE calculated_balance always represents the account's
 * expected (normal) state.
 * 
 * ACCOUNT TYPE BEHAVIOR:
 * ----------------------
 * PERMANENT ACCOUNTS (Asset, Liability, Equity):
 *   - Balance is CUMULATIVE from inception (opening balance + all transactions)
 *   - Used for Balance Sheet (Statement of Financial Position)
 *   - NOT reset at fiscal year end
 * 
 * TEMPORARY ACCOUNTS (Income, Expense, COGS):
 *   - Balance is PERIOD-SPECIFIC (only transactions within date range)
 *   - Used for Income Statement (Statement of Profit or Loss)
 *   - Reset to zero at fiscal year end (via closing entries)
 * 
 * BALANCE SHEET EQUATION (ASPE):
 * ------------------------------
 * Assets = Liabilities + Equity + Current Year Earnings (Net Income)
 * 
 * This equation must balance at all times. Net Income from the Income Statement
 * flows into Equity on the Balance Sheet.
 * 
 * INCOME STATEMENT STRUCTURE (ASPE):
 * ----------------------------------
 * Revenue (4xxx accounts)
 * - Cost of Goods Sold (5xxx accounts)
 * = Gross Profit
 * - Operating Expenses (6xxx accounts)
 * = Operating Income
 * + Other Income (7xxx accounts)
 * - Other Expenses (8xxx-9xxx accounts)
 * = Net Income
 * 
 * CASH FLOW STATEMENT (INDIRECT METHOD):
 * --------------------------------------
 * Operating Activities: Net Income + Non-cash adjustments + Working capital changes
 * Investing Activities: Changes in fixed assets and investments
 * Financing Activities: Changes in debt and equity
 * 
 * Net Change in Cash = Operating + Investing + Financing
 * Ending Cash = Beginning Cash + Net Change
 * 
 * WARNING: DO NOT MODIFY THESE FORMULAS without understanding GAAP implications.
 * ============================================================================
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from './useOrganization';
import { useFinancialReportsRealtime } from './useFinancialReportsRealtime';
import { startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths } from 'date-fns';
import { getFiscalYearForDate, getFiscalYearStart } from '@/lib/fiscalYearUtils';

interface AccountBalance {
  id: string;
  code: string;
  name: string;
  account_type: string;
  normal_balance: string;
  is_header: boolean;
  is_current: boolean;  // Whether the account is current or non-current (for Balance Sheet classification)
  parent_id: string | null;
  opening_balance: number;  // Balance at START of period (for permanent accounts: includes pre-period transactions)
  current_balance: number;  // Stored balance in database (metadata, may be out of sync)
  calculated_balance: number; // Balance at END of period (calculated from journal entries)
  ytd_balance: number; // Year-to-date balance for Balance Sheet net income calculation
  cash_flow_category?: string | null; // Explicit cash flow classification override
}

/**
 * ============================================================================
 * CASH FLOW DATA STRUCTURE - GAAP/ASPE COMPLIANT
 * ============================================================================
 * 
 * Per Canadian GAAP (Indirect Method):
 * 
 * OPERATING ACTIVITIES:
 *   Net Income (from Income Statement)
 *   + Non-cash adjustments (Depreciation, Amortization)
 *   +/- Working capital changes (AR, AP, Inventory, Prepaid)
 *   = Net Cash from Operating Activities
 * 
 * INVESTING ACTIVITIES:
 *   - Purchases of fixed assets
 *   + Sales of fixed assets
 *   +/- Changes in investments
 *   = Net Cash from Investing Activities
 * 
 * FINANCING ACTIVITIES:
 *   + Proceeds from borrowing
 *   - Debt repayments
 *   + Capital contributions
 *   - Dividends/distributions
 *   = Net Cash from Financing Activities
 * 
 * CASH RECONCILIATION:
 *   Beginning Cash (from Balance Sheet at start of period)
 *   + Net Change in Cash (Operating + Investing + Financing)
 *   = Ending Cash (must match Balance Sheet cash accounts)
 * 
 * ============================================================================
 */
interface CashFlowData {
  operatingActivities: { name: string; amount: number }[];
  investingActivities: { name: string; amount: number }[];
  financingActivities: { name: string; amount: number }[];
  netOperating: number;
  netInvesting: number;
  netFinancing: number;
  /**
   * Net Change in Cash = netOperating + netInvesting + netFinancing
   * This is the CALCULATED change based on activity classification.
   * For GAAP compliance, we use the ACTUAL change from GL (endingCash - beginningCash)
   * to ensure the cash flow statement ties to the Balance Sheet.
   */
  netChange: number;
  /**
   * Beginning Cash Balance = Sum of cash/bank account balances at START of period.
   * This must match the prior period's Ending Cash Balance.
   */
  beginningCash: number;
  /**
   * Ending Cash Balance = Sum of cash/bank account balances at END of period.
   * FORMULA: beginningCash + netChange = endingCash
   * This must match the Balance Sheet's cash/bank totals.
   */
  endingCash: number;
  // Reconciliation properties for audit trail
  actualCashChange: number;
  isReconciled: boolean;
  reconciliationDifference: number;
}

export interface DateRangeFilter {
  startDate?: Date;
  endDate?: Date;
  period?: 'month' | 'quarter' | 'year' | 'custom';
  /** Phase 4 — restrict to specific divisions (departments). Empty = consolidated. */
  departmentIds?: string[];
}

/**
 * Formats a Date object to YYYY-MM-DD string in LOCAL timezone.
 * CRITICAL: Avoids UTC conversion issues when comparing with database dates.
 */
const formatLocalDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Gets start of day in local timezone (00:00:00.000)
 */
const localStartOfDay = (date: Date): Date => {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
};

/**
 * Gets end of day in local timezone (23:59:59.999)
 */
const localEndOfDay = (date: Date): Date => {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
};

export function useFinancialReports(dateFilter?: DateRangeFilter) {
  const { organization: currentOrganization } = useCurrentOrganization();

  // Auto-refresh whenever GL data changes (bank, CC, manual JE, recalcs)
  const { lastEventAt: realtimeLastEventAt } = useFinancialReportsRealtime(currentOrganization?.id);

  // Determine date range (normalized to whole days in local timezone)
  const getDateRange = () => {
    const now = new Date();

    let start: Date;
    let end: Date;

    if (dateFilter?.startDate && dateFilter?.endDate) {
      start = dateFilter.startDate;
      end = dateFilter.endDate;
    } else {
      switch (dateFilter?.period) {
        case 'month':
          start = startOfMonth(now);
          end = endOfMonth(now);
          break;
        case 'quarter':
          start = startOfMonth(subMonths(now, 2));
          end = endOfMonth(now);
          break;
        case 'year':
          start = startOfYear(now);
          end = endOfYear(now);
          break;
        default:
          // Default to current fiscal year (assuming calendar year)
          start = startOfYear(now);
          end = now;
      }
    }

    // Use local timezone helpers to avoid UTC conversion issues
    return { startDate: localStartOfDay(start), endDate: localEndOfDay(end) };
  };

  const dateRange = getDateRange();

  // Fetch accounts with calculated balances from posted journal entries
  // Per GAAP:
  // - Permanent accounts (Asset, Liability, Equity): Cumulative balance from opening + all posted transactions up to end date
  // - Temporary accounts (Income, Expense, COGS): Activity within the date range only (reset at fiscal year start)
  const accountBalancesQuery = useQuery({
    queryKey: [
      'financial-reports',
      'account-balances',
      currentOrganization?.id,
      formatLocalDate(dateRange.startDate),
      formatLocalDate(dateRange.endDate),
      // Phase 4 — re-key when the division filter changes so reports re-compute.
      (dateFilter?.departmentIds ?? []).slice().sort().join(','),
    ],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];

      // Get all accounts
      const { data: accounts, error: accountsError } = await supabase
        .from('accounts')
        .select('*')
        .eq('organization_id', currentOrganization.id)
        .order('code');

      if (accountsError) throw accountsError;

      // Convert date range to local date strings for comparison (avoids timezone issues)
      const startDateStr = formatLocalDate(dateRange.startDate);
      const endDateStr = formatLocalDate(dateRange.endDate);

      // Get organization's fiscal year end month (default to December/calendar year)
      const fiscalYearEndMonth = currentOrganization.fiscal_year_end_month ?? 12;
      
      // Report fiscal year is derived from the report end date using org's fiscal year setting
      // For September FY end: FY2022 = Oct 1, 2021 to Sep 30, 2022
      const reportFiscalYear = getFiscalYearForDate(dateRange.endDate, fiscalYearEndMonth);
      const fiscalYearStart = getFiscalYearStart(reportFiscalYear, fiscalYearEndMonth);
      const fiscalYearStartStr = formatLocalDate(fiscalYearStart);

      // For Balance Sheet YTD net income, we need CUMULATIVE earnings from ALL unclosed years.
      // This ensures the accounting equation balances even when prior years haven't been closed.
      // We use a very early date to include all historical income/expense activity.

      // Get all posted/reversed journal entries up to the report end date.
      // CRITICAL: Supabase REST has a default 1000-row cap; we must paginate or
      // financial reports will silently exclude later entries.
      const fetchAllJournalEntries = async () => {
        const pageSize = 1000;
        const all: Array<{ id: string; entry_date: string; reference: string | null; department_id: string | null }> = [];
        let offset = 0;
        while (true) {
          const { data, error } = await supabase
            .from('journal_entries')
            .select('id, entry_date, reference, department_id')
            .eq('organization_id', currentOrganization.id)
            .in('status', ['posted', 'reversed'])
            .lte('entry_date', endDateStr)
            .order('id', { ascending: true })
            .range(offset, offset + pageSize - 1);
          if (error) throw error;
          const rows = (data ?? []) as typeof all;
          all.push(...rows);
          if (rows.length < pageSize) break;
          offset += pageSize;
        }
        return all;
      };

      const journalEntries = await fetchAllJournalEntries();

      const journalEntryIds = journalEntries?.map(je => je.id) ?? [];
      const entryDateMap = new Map(journalEntries?.map(e => [e.id, e.entry_date]) ?? []);
      // Phase 4 — header-level division (used as fallback when line has no override).
      const entryDeptMap = new Map(journalEntries?.map(e => [e.id, e.department_id]) ?? []);

      // Track fiscal year closing entries (CLOSE-YYYY format) to exclude from net income calculations
      // This ensures Current Year Earnings shows actual period P&L, not zeroed-out closed amounts
      const closingEntryIds = new Set(
        journalEntries?.filter(e => e.reference?.startsWith('CLOSE-')).map(e => e.id) ?? []
      );

      // Fetch journal entry lines (IMPORTANT: paginate; REST has a default 1000 row limit)
      let journalLines: Array<{ id: string; account_id: string; debit: number; credit: number; base_currency_debit: number | null; base_currency_credit: number | null; journal_entry_id: string; department_id: string | null }> = [];

      const fetchAllLinesForEntries = async (entryIds: string[]) => {
        const chunkSize = 200; // keep URL length manageable
        const pageSize = 1000;
        const all: typeof journalLines = [];

        for (let i = 0; i < entryIds.length; i += chunkSize) {
          const chunk = entryIds.slice(i, i + chunkSize);
          let offset = 0;

          while (true) {
            const { data, error } = await supabase
              .from('journal_entry_lines')
              .select('id, account_id, debit, credit, base_currency_debit, base_currency_credit, journal_entry_id, department_id')
              .in('journal_entry_id', chunk)
              .order('id', { ascending: true })
              .range(offset, offset + pageSize - 1);

            if (error) throw error;
            const rows = (data ?? []) as typeof all;
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

      // Phase 4 — apply division filter (effective_department_id = line override OR header).
      const departmentFilter = dateFilter?.departmentIds ?? [];
      if (departmentFilter.length > 0) {
        const allowed = new Set(departmentFilter);
        journalLines = journalLines.filter((l) => {
          const eff = l.department_id ?? entryDeptMap.get(l.journal_entry_id) ?? null;
          return eff !== null && allowed.has(eff);
        });
      }

      // ----------------------------------------------------------------------
      // Retained Earnings rollforward (reporting-layer computation)
      // ----------------------------------------------------------------------
      // To satisfy the rollforward formula even when prior years are not formally
      // closed, we compute Opening Retained Earnings for the report fiscal year as:
      //   Opening RE(Y) = RE postings up to prior year end + cumulative NI of any
      //                  UN-CLOSED prior years
      // This value is then used as the base for the Retained Earnings account's
      // opening/closing balances in the Balance Sheet.
      let retainedEarningsOpeningCents: number | null = null;
      try {
        const { data: openingRE, error: openingREError } = await supabase.rpc(
          'calculate_opening_retained_earnings',
          {
            p_organization_id: currentOrganization.id,
            p_fiscal_year: reportFiscalYear,
          }
        );
        if (openingREError) throw openingREError;
        // Avoid using helper closures declared later in this function.
        retainedEarningsOpeningCents = Math.round((Number(openingRE) || 0) * 100);
      } catch {
        // Fail open: if the rollforward function is unavailable for any reason,
        // fall back to the legacy journal-line based calculation.
        retainedEarningsOpeningCents = null;
      }

      const isPermanentAccount = (type: string) => 
        ['asset', 'liability', 'equity'].includes(type);

      // startDateStr and endDateStr computed above
      /**
       * For Balance Sheet: Calculate CUMULATIVE net income from ALL transactions
       * This handles the case where no closing entries have been made between fiscal years.
       * The net income represents unretained earnings that should flow to equity.
       * Once a closing entry is posted (moving net income to Retained Earnings),
       * this will correctly show zero for current year earnings after closing.
       */

      /**
       * GAAP PRINCIPLE: Opening balances only apply when the period includes/follows
       * the business start date. For comparison periods before any transactions exist,
       * opening balances should be zero to avoid false historical data.
       */
      const allEntryDates = journalLines
        .map(l => entryDateMap.get(l.journal_entry_id))
        .filter((d): d is string => !!d);
      
      const earliestTransactionDate = allEntryDates.length > 0
        ? allEntryDates.sort()[0] // YYYY-MM-DD format sorts correctly
        : null;
      
      // Opening balance only applies if the period END is >= earliest transaction date
      const shouldIncludeOpeningBalance = earliestTransactionDate
        ? endDateStr >= earliestTransactionDate
        : false;

      // Use integer cents throughout to prevent floating-point drift
      const toCents = (n: number) => Math.round(n * 100);
      const fromCents = (n: number) => n / 100;

      // Calculate balances for each account per GAAP
      const balances: AccountBalance[] = accounts?.map(account => {
        const accountLines = journalLines.filter(l => l.account_id === account.id);
        
        let calculatedBalanceCents = 0;
        let periodOpeningBalanceCents = 0; // Balance at the START of the period
        let ytdBalanceCents = 0; // Year-to-date balance for Balance Sheet net income calculation

        if (isPermanentAccount(account.account_type)) {
          // PERMANENT ACCOUNTS: Cumulative balance = Opening + ALL transactions up to end date
          // This ensures Balance Sheet shows point-in-time cumulative balances
          const baseOpeningCents = shouldIncludeOpeningBalance 
            ? toCents(Number(account.opening_balance) || 0)
            : 0;
          
          // Calculate period opening balance (all transactions BEFORE period start)
          periodOpeningBalanceCents = baseOpeningCents;
          for (const line of accountLines) {
            const entryDate = entryDateMap.get(line.journal_entry_id);
            if (!entryDate) continue;
            
            // Compare date strings directly to avoid timezone issues
            // entryDate is already YYYY-MM-DD format from the database
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
          
          // Calculate closing balance (all transactions up to end date)
          // CRITICAL: For Retained Earnings, exclude CLOSE-* entries to show opening balance only
          // The CLOSE-* entries transfer Current Year Earnings to Retained Earnings,
          // but we display Current Year Earnings separately, so we must exclude closing entries
          // from Retained Earnings to avoid double-counting
          const isRetainedEarningsAccount = account.code?.startsWith('3-00-201') || 
            account.name?.toLowerCase().includes('retained earnings');

          if (isRetainedEarningsAccount && retainedEarningsOpeningCents !== null) {
            // New rollforward behavior:
            // Start RE at Opening RE for the fiscal year, then add ONLY current-year
            // direct RE postings (adjustments/dividends), excluding same-year CLOSE-*.
            // This makes RE non-zero even if prior years were never formally closed.

            // Recompute period opening and closing for RE using fiscal-year start baseline
            periodOpeningBalanceCents = retainedEarningsOpeningCents;
            calculatedBalanceCents = retainedEarningsOpeningCents;

            for (const line of accountLines) {
              const entryDate = entryDateMap.get(line.journal_entry_id);
              if (!entryDate) continue;

              // Exclude CLOSE-YYYY for the report fiscal year to avoid double counting with CYE
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
            // Legacy behavior: derive RE purely from journal lines (excludes same-year CLOSE-*)
            calculatedBalanceCents = baseOpeningCents;
            for (const line of accountLines) {
              const entryDate = entryDateMap.get(line.journal_entry_id);
              if (!entryDate) continue;
              
              // For Retained Earnings: Only exclude CLOSE-* entries from the SAME fiscal year
              // Prior year closing entries ARE part of opening RE for subsequent years
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
          
          // YTD balance same as calculated for permanent accounts
          ytdBalanceCents = calculatedBalanceCents;
        } else {
          // TEMPORARY ACCOUNTS: Activity within the date range only
          // This ensures Income Statement shows period activity only
          // Opening balance for temporary accounts is always 0 for the period
          // CRITICAL: Exclude fiscal year closing entries (CLOSE-*) from calculations
          // This ensures Current Year Earnings shows actual period P&L, not zeroed-out amounts
          periodOpeningBalanceCents = 0;
          
          // Calculate balance for the selected period (for Income Statement)
          for (const line of accountLines) {
            const entryDate = entryDateMap.get(line.journal_entry_id);
            if (!entryDate) continue;
            
            // Skip closing entries - they zero out temporary accounts but we want to show actual activity
            if (closingEntryIds.has(line.journal_entry_id)) continue;
            
            // Compare date strings directly to avoid timezone issues
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
          
          // Calculate Balance Sheet earnings component (for Balance Sheet equation).
          // IMPORTANT:
          // - Income Statement should be PERIOD activity (handled by calculatedBalanceCents above)
          // - Balance Sheet must ALWAYS balance, even when prior years have NOT been closed.
          //   Therefore, for temporary accounts we must use the cumulative balance as-of endDate
          //   (i.e., the current balance of income/expense accounts at that date).
          // - We INCLUDE CLOSE-* entries here because closing entries are what reset temporary
          //   accounts to zero; including them ensures closed years do not leak into the
          //   Balance Sheet earnings component.
          for (const line of accountLines) {
            const entryDate = entryDateMap.get(line.journal_entry_id);
            if (!entryDate) continue;

            // Include all activity up to and including the report end date
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
          opening_balance: fromCents(periodOpeningBalanceCents), // Now represents balance at START of period
          current_balance: account.current_balance || 0,
          calculated_balance: fromCents(calculatedBalanceCents), // Balance at END of period (for Income Statement)
          ytd_balance: fromCents(ytdBalanceCents), // Year-to-date balance (for Balance Sheet net income)
          cash_flow_category: account.cash_flow_category,
        };
      }) ?? [];

      return balances;
    },
    enabled: !!currentOrganization?.id,
  });

  /**
   * ============================================================================
   * BALANCE SHEET DATA (Statement of Financial Position)
   * ============================================================================
   * 
   * Per ASPE/Canadian GAAP: Assets = Liabilities + Equity + Net Income
   * 
   * CRITICAL CALCULATION LOGIC:
   * ---------------------------
   * The calculated_balance is NORMALIZED based on normal_balance:
   *   - Debit-normal accounts: calculated_balance = Σ(debits) - Σ(credits)
   *   - Credit-normal accounts: calculated_balance = Σ(credits) - Σ(debits)
   * 
   * A POSITIVE calculated_balance means the account has its expected (normal) balance.
   * 
   * SECTION TOTALS:
   * ---------------
   * ASSETS (expected normal: debit):
   *   - Debit-normal assets (Cash, AR, Equipment): ADD to total
   *   - Credit-normal assets (Accumulated Depreciation): SUBTRACT from total
   * 
   * LIABILITIES (expected normal: credit):
   *   - Credit-normal liabilities (AP, Loans): ADD to total
   *   - Debit-normal liabilities (contra-liabilities): SUBTRACT from total
   * 
   * EQUITY (expected normal: credit):
   *   - Credit-normal equity (Retained Earnings, Capital): ADD to total
   *   - Debit-normal equity (Owner's Drawings): SUBTRACT from total
   * 
   * BALANCE CHECK: |Assets - (Liabilities + Equity + Net Income)| < 0.01
   * 
   * WARNING: DO NOT MODIFY THIS LOGIC without GAAP review.
   * ============================================================================
   */
  /**
   * ============================================================================
   * BALANCE SHEET DATA - PURE FORMULA APPROACH (ASPE/GAAP COMPLIANT)
   * ============================================================================
   * 
   * This implementation follows PURE FORMULA accounting - NO static value additions.
   * All amounts derive from journal entries via the double-entry system.
   * 
   * ACCOUNTING EQUATION:
   *   Assets = Liabilities + Equity + Net Income (Current Year Earnings)
   * 
   * RETAINED EARNINGS CONTINUITY:
   *   Opening RE (Year N) = Closing RE (Year N-1)
   *   This is maintained automatically via journal entries (including CLOSE-* entries)
   * 
   * CURRENT YEAR EARNINGS:
   *   = Dynamically calculated: Revenue - Expenses (from P&L accounts)
   *   = This is what flows from the Income Statement to the Balance Sheet
   * 
   * The database stores equity balances via journal entries. We do NOT manually
   * add or manipulate account balances. Year-to-year continuity is maintained
   * by proper journal entries (opening entries, closing entries).
   * ============================================================================
   */
  const getBalanceSheetData = () => {
    const accounts = accountBalancesQuery.data ?? [];
    
    const assets = accounts.filter(a => a.account_type === 'asset' && !a.is_header);
    const liabilities = accounts.filter(a => a.account_type === 'liability' && !a.is_header);
    
    // PURE FORMULA: Include ALL equity accounts as-is from the database
    // No manual exclusions or additions - the database reflects journal entry activity
    const equity = accounts.filter(a => a.account_type === 'equity' && !a.is_header);

    /**
     * BALANCE SHEET TOTAL CALCULATIONS
     * =================================
     * Each account's calculated_balance is ALREADY normalized based on normal_balance:
     * - For debit-normal accounts: calculated_balance = debits - credits
     * - For credit-normal accounts: calculated_balance = credits - debits
     * 
     * A POSITIVE calculated_balance means the account is in its normal state.
     * 
     * For section totals:
     * - ASSETS: Debit-normal accounts ADD (positive is normal), Credit-normal SUBTRACT (contra)
     * - LIABILITIES: Credit-normal accounts ADD (positive is normal), Debit-normal SUBTRACT (contra)
     * - EQUITY: Credit-normal accounts ADD (positive is normal), Debit-normal SUBTRACT (contra)
     */

    /**
     * LOCKED FORMULA - USE INTEGER CENTS TO PREVENT FLOATING POINT DRIFT
     * This ensures the balance sheet equation remains stable across all operations.
     */
    const toCents = (n: number) => Math.round(n * 100);
    const fromCents = (n: number) => n / 100;

    // Assets: Debit-normal add, credit-normal (contra) subtract
    const totalAssetsCents = assets.reduce((sum, a) => {
      const sign = a.normal_balance === 'debit' ? 1 : -1;
      return sum + toCents(a.calculated_balance) * sign;
    }, 0);
    const totalAssets = fromCents(totalAssetsCents);
    
    // Liabilities: Credit-normal add, debit-normal (contra) subtract
    const totalLiabilitiesCents = liabilities.reduce((sum, a) => {
      const sign = a.normal_balance === 'credit' ? 1 : -1;
      return sum + toCents(a.calculated_balance) * sign;
    }, 0);
    const totalLiabilities = fromCents(totalLiabilitiesCents);
    
    // Equity: Credit-normal add, debit-normal (contra like Owner's Drawings) subtract
    // PURE FORMULA: Include ALL equity accounts as recorded in the database
    const totalEquityCents = equity.reduce((sum, a) => {
      const sign = a.normal_balance === 'credit' ? 1 : -1;
      return sum + toCents(a.calculated_balance) * sign;
    }, 0);
    const totalEquity = fromCents(totalEquityCents);

    /**
     * NET INCOME FOR BALANCE SHEET (Cumulative / YTD)
     * ------------------------------------------------
     * Uses ytd_balance (cumulative from inception to end date) so that
     * the net income figure matches the cumulative nature of Assets,
     * Liabilities, and Equity on the Balance Sheet.
     *
     * When fiscal year closing entries (CLOSE-*) exist they zero out
     * that year's temporary accounts, so closed years contribute $0.
     * Unclosed years contribute their actual earnings.
     *
     * Net Income = Σ(credit-normal ytd) − Σ(debit-normal ytd)
     */
    const tempAccounts = accounts.filter(
      a => !a.is_header && !['asset', 'liability', 'equity'].includes(a.account_type)
    );

    const netIncomeCents = tempAccounts.reduce((sum, a) => {
      const amt = toCents(a.ytd_balance || 0);
      // Credit-normal (income) adds to earnings; debit-normal (expense) subtracts
      return sum + (a.normal_balance === 'credit' ? amt : -amt);
    }, 0);
    const netIncome = fromCents(netIncomeCents);

    // The accounting equation: Assets = Liabilities + Equity + Net Income
    // PURE FORMULA using integer cents arithmetic to prevent floating point errors
    // Note: totalEquityCents includes ALL equity accounts as recorded in the database
    const differenceCents = Math.abs(totalAssetsCents - totalLiabilitiesCents - totalEquityCents - netIncomeCents);
    const difference = fromCents(differenceCents);
    const isBalanced = differenceCents < 1; // Less than 1 cent tolerance

    // Debug logging for balance issues
    if (!isBalanced) {
      console.warn('Balance Sheet Out of Balance:', {
        totalAssets,
        totalLiabilities,
        totalEquity,
        netIncome,
        expectedLiabilitiesEquity: totalLiabilities + totalEquity + netIncome,
        difference,
      });
    }

    return {
      assets,
      liabilities,
      equity,
      totalAssets,
      totalLiabilities,
      totalEquity,
      netIncome,
      isBalanced,
      difference, // Expose the difference for debugging
    };
  };

  /**
   * ============================================================================
   * INCOME STATEMENT DATA (Statement of Profit or Loss)
   * ============================================================================
   * 
   * ASPE/Canadian GAAP Income Statement Structure:
   * 
   * REVENUE (4xxx accounts)
   * - Cost of Sales (5xxx accounts)
   * = GROSS PROFIT
   * 
   * - Total Operating Expenses (6xxx accounts)
   * = OPERATING INCOME
   * 
   * + Non-operating Income (7xxx accounts)
   * - Non-operating Expenses (8xxx accounts)
   * = INCOME BEFORE INCOME TAXES
   * 
   * - Income Tax Expense (9xxx accounts)
   * = NET INCOME (LOSS)
   * 
   * ACCOUNT CODE CONVENTIONS (ASPE):
   * --------------------------------
   * 4xxx - Sales Revenue, Service Revenue
   * 5xxx - Cost of Sales / COGS
   * 6xxx - Operating Expenses (Rent, Utilities, Wages, etc.)
   * 7xxx - Non-operating Income (Interest Income, FX Gain, Gain on Disposal, Grants)
   * 8xxx - Non-operating Expenses (Interest Expense, FX Loss, Loss on Disposal)
   * 9xxx - Income Tax Expense (Current Tax, Deferred Tax)
   * 
   * NOTE: All income/expense accounts use calculated_balance directly since
   * they are already normalized based on their normal_balance.
   * 
   * WARNING: DO NOT MODIFY THIS LOGIC without GAAP/ASPE review.
   * ============================================================================
   */
  const getIncomeStatementDataInternal = (accounts: AccountBalance[]) => {
    // Helper to check if account code starts with given prefix
    const codeStartsWith = (code: string, prefix: string) => code.startsWith(prefix);
    
    // Operating Revenue (4xxx codes - main revenue accounts)
    const income = accounts.filter(a => 
      a.account_type === 'income' && 
      !a.is_header &&
      (codeStartsWith(a.code, '4') || (!codeStartsWith(a.code, '7') && !codeStartsWith(a.code, '8') && !codeStartsWith(a.code, '9')))
    );
    
    // Non-Operating/Other Income — any income-type account coded 7xxx or 8xxx
    // (account_type is the source of truth; 8xxx legacy numbering is still surfaced)
    const otherIncome = accounts.filter(a => 
      a.account_type === 'income' && 
      !a.is_header &&
      (codeStartsWith(a.code, '7') || codeStartsWith(a.code, '8'))
    );
    
    // Cost of Goods Sold (5xxx codes within expense type)
    const cogs = accounts.filter(a => 
      a.account_type === 'expense' && 
      !a.is_header &&
      codeStartsWith(a.code, '5')
    );
    
    // Operating Expenses (6xxx codes within expense type)
    const expenses = accounts.filter(a => 
      a.account_type === 'expense' && 
      !a.is_header &&
      codeStartsWith(a.code, '6')
    );
    
    // Non-Operating Expenses (7xxx-8xxx codes within expense type)
    const nonOperatingExpenses = accounts.filter(a => 
      a.account_type === 'expense' && 
      !a.is_header &&
      (codeStartsWith(a.code, '7') || codeStartsWith(a.code, '8'))
    );

    // Income Tax Expense (9xxx codes within expense type)
    const incomeTaxExpenses = accounts.filter(a => 
      a.account_type === 'expense' && 
      !a.is_header &&
      codeStartsWith(a.code, '9')
    );

    // Union for backward-compatibility consumers
    const otherExpenses = [...nonOperatingExpenses, ...incomeTaxExpenses];

    // Use integer cents to prevent floating point drift in financial calculations
    const toCents = (n: number) => Math.round(n * 100);
    const fromCents = (n: number) => n / 100;

    /**
     * CONTRA-ACCOUNT HANDLING (GAAP/ASPE Compliant)
     * ==============================================
     * Income accounts can have different normal_balance values:
     * - Credit-normal (Sales Revenue, Service Revenue): ADD to total revenue
     * - Debit-normal (Sales Discounts, Sales Returns & Allowances): SUBTRACT from total revenue
     * 
     * Similarly for expense accounts:
     * - Debit-normal (most expenses): ADD to total expenses
     * - Credit-normal (Purchase Discounts, contra-expense): SUBTRACT from total expenses
     */
    const totalRevenueCents = income.reduce((sum, a) => {
      const sign = a.normal_balance === 'credit' ? 1 : -1;
      return sum + toCents(a.calculated_balance) * sign;
    }, 0);
    
    const totalOtherIncomeCents = otherIncome.reduce((sum, a) => {
      const sign = a.normal_balance === 'credit' ? 1 : -1;
      return sum + toCents(a.calculated_balance) * sign;
    }, 0);
    
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

    const totalRevenue = fromCents(totalRevenueCents);
    const totalOtherIncome = fromCents(totalOtherIncomeCents);
    const totalCOGS = fromCents(totalCOGSCents);
    const totalExpenses = fromCents(totalExpensesCents);
    const totalOtherExpenses = fromCents(totalOtherExpensesCents);
    const totalNonOperatingExpenses = fromCents(totalNonOperatingExpensesCents);
    const totalIncomeTax = fromCents(totalIncomeTaxCents);
    const grossProfit = fromCents(grossProfitCents);
    const operatingIncome = fromCents(operatingIncomeCents);
    const incomeBeforeTax = fromCents(incomeBeforeTaxCents);
    const netIncome = fromCents(netIncomeCents);

    return {
      income, otherIncome, cogs, expenses, otherExpenses,
      nonOperatingExpenses, incomeTaxExpenses,
      totalRevenue, totalOtherIncome, totalCOGS, totalExpenses, totalOtherExpenses,
      totalNonOperatingExpenses, totalIncomeTax,
      grossProfit, operatingIncome, incomeBeforeTax, netIncome,
      grossMargin: totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0,
      netMargin: totalRevenue > 0 ? (netIncome / totalRevenue) * 100 : 0,
    };
  };

  // Get income statement data - public wrapper around internal helper
  const getIncomeStatementData = () => {
    const accounts = accountBalancesQuery.data ?? [];
    return getIncomeStatementDataInternal(accounts);
  };

  // Get current year earnings for balance sheet
  const getCurrentYearEarnings = () => {
    const incomeData = getIncomeStatementData();
    return incomeData.netIncome;
  };

  // Get cash flow statement data using indirect method
  const getCashFlowData = (): CashFlowData => {
    const accounts = accountBalancesQuery.data ?? [];
    const incomeData = getIncomeStatementData();
    
    // Helper to check if code starts with any of the given prefixes
    const codeStartsWith = (code: string, prefixes: string[]) => 
      prefixes.some(prefix => code.startsWith(prefix));
    
    // Helper to check if name contains any of the given keywords
    const nameContains = (name: string, keywords: string[]) => {
      const lowerName = name.toLowerCase();
      return keywords.some(keyword => lowerName.includes(keyword.toLowerCase()));
    };

    // Operating activities - start with net income
    const operatingActivities: { name: string; amount: number }[] = [];
    operatingActivities.push({ name: 'Net Income', amount: incomeData.netIncome });
    
    // Add back non-cash expenses (depreciation/amortization)
    const depreciationAccounts = accounts.filter(a => 
      a.account_type === 'expense' && 
      nameContains(a.name, ['depreciation', 'amortization'])
    );
    depreciationAccounts.forEach(acc => {
      if (acc.calculated_balance !== 0) {
        operatingActivities.push({ name: `Add: ${acc.name}`, amount: acc.calculated_balance });
      }
    });
    
    // Changes in working capital - AR (decrease in AR = +cash, increase = -cash)
    // For debit-normal assets, calculated_balance is (debits - credits), so positive = increase
    // An INCREASE in AR means we've earned revenue but not collected cash yet (uses cash)
    // A DECREASE in AR means we collected cash from prior period sales (provides cash)
    const arAccounts = accounts.filter(a => 
      a.account_type === 'asset' && 
      !a.is_header &&
      (nameContains(a.name, ['receivable', 'a/r']) || codeStartsWith(a.code, ['11', '110', '111', '112']))
    );
    const arChange = arAccounts.reduce((sum, a) => {
      // calculated_balance is normalized: positive = normal balance (asset = has value)
      // opening_balance is also normalized the same way
      const change = a.calculated_balance - a.opening_balance;
      return sum + change;
    }, 0);
    if (Math.abs(arChange) > 0.01) {
      operatingActivities.push({ 
        name: 'Change in Accounts Receivable', 
        amount: -arChange // Increase in AR uses cash (negative), decrease provides cash (positive)
      });
    }
    
    // Changes in inventory
    const inventoryAccounts = accounts.filter(a => 
      a.account_type === 'asset' && 
      !a.is_header &&
      (nameContains(a.name, ['inventory', 'stock']) || codeStartsWith(a.code, ['12', '120', '121']))
    );
    const inventoryChange = inventoryAccounts.reduce((sum, a) => sum + (a.calculated_balance - a.opening_balance), 0);
    if (Math.abs(inventoryChange) > 0.01) {
      operatingActivities.push({ 
        name: 'Change in Inventory', 
        amount: -inventoryChange // Increase in inventory uses cash
      });
    }
    
    // Changes in prepaid expenses
    const prepaidAccounts = accounts.filter(a => 
      a.account_type === 'asset' && 
      !a.is_header &&
      (nameContains(a.name, ['prepaid', 'prepayment']) || codeStartsWith(a.code, ['13', '130']))
    );
    const prepaidChange = prepaidAccounts.reduce((sum, a) => sum + (a.calculated_balance - a.opening_balance), 0);
    if (Math.abs(prepaidChange) > 0.01) {
      operatingActivities.push({ 
        name: 'Change in Prepaid Expenses', 
        amount: -prepaidChange // Increase in prepaid uses cash
      });
    }
    
    // Changes in AP (increase in AP = +cash, decrease = -cash)
    // For credit-normal liabilities, calculated_balance is (credits - debits), so positive = we owe money
    // An INCREASE in AP means we've incurred expenses but not paid yet (provides cash)
    // A DECREASE in AP means we paid off prior obligations (uses cash)
    // Note: Exclude tax-related accounts as they're handled separately
    const apAccounts = accounts.filter(a => 
      a.account_type === 'liability' && 
      !a.is_header &&
      (nameContains(a.name, ['payable', 'a/p', 'accrued', 'wages']) || codeStartsWith(a.code, ['20', '200', '21', '210', '23'])) &&
      !nameContains(a.name, ['tax', 'gst', 'hst', 'pst', 'qst', 'cpp', 'ei', 'income tax'])
    );
    const apChange = apAccounts.reduce((sum, a) => {
      const change = a.calculated_balance - a.opening_balance;
      // For credit-normal liabilities: positive change = liability increased = cash saved
      // For debit-normal (contra): positive change = contra increased = liability effectively decreased = cash used
      const sign = a.normal_balance === 'credit' ? 1 : -1;
      return sum + (change * sign);
    }, 0);
    if (Math.abs(apChange) > 0.01) {
      operatingActivities.push({ 
        name: 'Change in Accounts Payable', 
        amount: apChange // Increase in AP provides cash (positive)
      });
    }
    
    // Changes in tax liabilities
    // Same logic as AP: increase in liability = cash provided
    const taxLiabilityAccounts = accounts.filter(a => 
      a.account_type === 'liability' && 
      !a.is_header &&
      (nameContains(a.name, ['tax', 'gst', 'hst', 'pst', 'qst', 'cpp', 'ei', 'income tax']) || codeStartsWith(a.code, ['22', '220', '221', '23']))
    );
    const taxLiabilityChange = taxLiabilityAccounts.reduce((sum, a) => {
      const change = a.calculated_balance - a.opening_balance;
      // For credit-normal: positive change = liability increased = cash saved
      // For debit-normal (contra like GST Paid): positive change = we paid more GST = cash used
      const sign = a.normal_balance === 'credit' ? 1 : -1;
      return sum + (change * sign);
    }, 0);
    if (Math.abs(taxLiabilityChange) > 0.01) {
      operatingActivities.push({ 
        name: 'Change in Tax Liabilities', 
        amount: taxLiabilityChange
      });
    }
    
    const netOperating = operatingActivities.reduce((sum, item) => sum + item.amount, 0);

    // Investing activities - fixed assets and investments
    // CRITICAL: Exclude accumulated depreciation accounts - these are NON-CASH contra-assets
    // Accumulated depreciation is already handled in Operating Activities as an add-back
    const investingActivities: { name: string; amount: number }[] = [];
    
    /**
     * CAPEX DETECTION PATTERNS:
     * ========================
     * Supports multiple Chart of Accounts structures:
     * - DAPRO/Legacy CoA: 15xx, 16xx, 17xx prefixes for fixed assets
     * - Kairos/Modern CoA: 1-02-xxx prefixes for fixed assets (account_group = 'Fixed Asset')
     * - Also detect by account_group for flexibility
     * 
     * EXCLUDE: Accumulated Depreciation (non-cash contra-asset already handled in Operating)
     */
    const isFixedAssetByCode = (code: string) => {
      // Legacy numeric prefixes (15x, 16x, 17x)
      if (codeStartsWith(code, ['15', '150', '151', '152', '153', '16', '160', '17', '170'])) return true;
      // Modern structured prefixes (1-02-xxx for Property Plant Equipment, Intangibles, etc.)
      if (code.startsWith('1-02')) return true;
      return false;
    };
    
    const fixedAssetAccounts = accounts.filter(a => 
      a.account_type === 'asset' && 
      !a.is_header &&
      // Must NOT be accumulated depreciation (contra-asset, non-cash)
      !nameContains(a.name, ['accumulated', 'depreciation', 'amortization', 'accum']) &&
      // Must be a fixed asset type - by code pattern, name keywords, cash_flow_category, or is_current
      (isFixedAssetByCode(a.code) ||
       a.cash_flow_category === 'investing' ||
       nameContains(a.name, ['equipment', 'property', 'vehicle', 'furniture', 'computer', 'machinery', 'building', 'land', 'fixture', 'software', 'franchise', 'license', 'patent', 'goodwill']))
    );
    
    fixedAssetAccounts.forEach(acc => {
      const change = acc.calculated_balance - acc.opening_balance;
      if (Math.abs(change) > 0.01) {
        investingActivities.push({ 
          name: change > 0 ? `Purchase of ${acc.name}` : `Sale of ${acc.name}`, 
          amount: -change // Purchases use cash (negative), sales provide cash (positive when change is negative)
        });
      }
    });
    
    // Investment accounts
    const investmentAccounts = accounts.filter(a => 
      a.account_type === 'asset' && 
      !a.is_header &&
      nameContains(a.name, ['investment', 'securities', 'bonds'])
    );
    investmentAccounts.forEach(acc => {
      const change = acc.calculated_balance - acc.opening_balance;
      if (Math.abs(change) > 0.01) {
        investingActivities.push({ 
          name: change > 0 ? `Purchase of ${acc.name}` : `Sale of ${acc.name}`, 
          amount: -change
        });
      }
    });
    
    const netInvesting = investingActivities.reduce((sum, item) => sum + item.amount, 0);

    // Financing activities - loans, notes, equity
    const financingActivities: { name: string; amount: number }[] = [];
    
    /**
     * LOAN/DEBT ACCOUNTS (Financing Activities)
     * ==========================================
     * Detects various loan and debt instruments:
     * - Bank loans, mortgages, notes payable
     * - Shareholder loans, related party loans
     * - Credit lines (not credit card accounts which are operational)
     * 
     * Supports multiple Chart of Accounts structures:
     * - Legacy CoA: 25xx, 26xx, 27xx prefixes
     * - Modern CoA: 2-02-xxx for long-term liabilities, 2-01-108 for shareholder loans
     */
    const isLoanByCode = (code: string) => {
      // Legacy prefixes
      if (codeStartsWith(code, ['25', '250', '26', '260', '27', '270'])) return true;
      // Modern structured prefixes for long-term liabilities
      if (code.startsWith('2-02')) return true;
      // Shareholder/related party loans (often current liability classification)
      if (code.startsWith('2-01-108') || code.startsWith('2-01-106')) return true;
      return false;
    };
    
    const loanAccounts = accounts.filter(a => 
      a.account_type === 'liability' && 
      !a.is_header &&
      (nameContains(a.name, ['loan', 'note', 'mortgage', 'debt', 'credit line', 'line of credit', 'shareholder', 'related party', 'due to']) || 
       isLoanByCode(a.code)) &&
      // Exclude credit card accounts (operational, not financing)
      !nameContains(a.name, ['credit card'])
    );
    loanAccounts.forEach(acc => {
      const change = acc.calculated_balance - acc.opening_balance;
      if (Math.abs(change) > 0.01) {
        // For credit-normal liabilities: positive change = borrowed more = cash inflow
        // negative change = paid down = cash outflow
        financingActivities.push({ 
          name: change > 0 ? `Proceeds from ${acc.name}` : `Repayment of ${acc.name}`, 
          amount: change
        });
      }
    });
    
    /**
     * EQUITY CHANGES (Financing Activities)
     * ======================================
     * Detects share capital contributions, dividends, distributions, and drawings.
     * 
     * CAPITAL CONTRIBUTIONS (provides cash):
     * - Common Stock, Preferred Stock, Share Capital
     * - Additional Paid-In Capital
     * - Owner's Capital, Capital Contribution
     * 
     * DISTRIBUTIONS (uses cash):
     * - Dividends, Distributions, Owner's Drawings
     * 
     * EXCLUDED from financing (handled elsewhere):
     * - Retained Earnings (accumulated from prior P&L, not a cash transaction)
     * - Current Year Earnings (flows from Income Statement, not financing)
     */
    const equityChangeAccounts = accounts.filter(a => 
      a.account_type === 'equity' && 
      !a.is_header &&
      // Include share capital, paid-in capital, contributions, and distributions
      (nameContains(a.name, [
        'dividend', 'distribution', 'drawing', 'contribution', 'capital', 'owner',
        'stock', 'share', 'paid-in', 'paid in', 'treasury'
      ]) ||
      // Also include by account code pattern (3-00-1xx for share capital accounts)
      a.code.startsWith('3-00-10')) &&
      // EXCLUDE retained earnings and current year earnings (not cash transactions)
      !nameContains(a.name, ['retained', 'earnings', 'current year', 'accumulated surplus'])
    );
    
    equityChangeAccounts.forEach(acc => {
      const change = acc.calculated_balance - acc.opening_balance;
      if (Math.abs(change) > 0.01) {
        const isDistribution = nameContains(acc.name, ['dividend', 'distribution', 'drawing', 'treasury']);
        financingActivities.push({ 
          name: acc.name, 
          amount: isDistribution ? -change : change
        });
      }
    });
    
    const netFinancing = financingActivities.reduce((sum, item) => sum + item.amount, 0);

    /**
     * CASH ACCOUNT DETECTION PATTERNS:
     * =================================
     * Supports multiple Chart of Accounts structures:
     * - DAPRO/Legacy CoA: 10xx prefixes for cash accounts
     * - Kairos/Modern CoA: 1-01-101 prefixes for cash accounts
     * - Also detect by name keywords for flexibility
     */
    const isCashByCode = (code: string) => {
      // Legacy numeric prefix (10xx)
      if (code.startsWith('10') && code.length >= 3 && code.length <= 5) return true;
      // Modern structured prefix (1-01-101 for cash/bank accounts)
      if (code.startsWith('1-01-101')) return true;
      return false;
    };
    
    const cashAccounts = accounts.filter(a => 
      a.account_type === 'asset' && 
      !a.is_header &&
      (nameContains(a.name, ['cash', 'bank', 'chequing', 'checking', 'savings', 'petty cash', 'operating bank']) || 
       isCashByCode(a.code))
    );
    
    // For cash accounts (debit-normal assets):
    // calculated_balance is already normalized: debits - credits
    // A positive calculated_balance = we have cash
    // A negative calculated_balance = overdrawn
    // opening_balance and calculated_balance are already in the correct sign convention
    const beginningCash = cashAccounts.reduce((sum, a) => sum + a.opening_balance, 0);
    const endingCash = cashAccounts.reduce((sum, a) => sum + a.calculated_balance, 0);
    
    // The actual change in cash from GL
    const actualCashChange = endingCash - beginningCash;
    
    // Cash Flow Equation: Net Change = Operating + Investing + Financing
    // For GAAP compliance, we use the ACTUAL cash change from GL balances
    // The difference between calculated and actual represents unclassified items
    const calculatedNetChange = netOperating + netInvesting + netFinancing;
    
    // Use ACTUAL cash change to ensure ending cash matches balance sheet
    const netChange = actualCashChange;
    
    // Flag if there's a reconciliation difference (for debugging/auditing)
    const reconciliationDifference = Math.abs(actualCashChange - calculatedNetChange);
    const isReconciled = reconciliationDifference < 0.01;

    return {
      operatingActivities,
      investingActivities,
      financingActivities,
      netOperating,
      netInvesting,
      netFinancing,
      netChange,
      beginningCash,
      endingCash,
      // Reconciliation info
      actualCashChange,
      isReconciled,
      reconciliationDifference,
    };
  };

  return {
    accountBalances: accountBalancesQuery.data ?? [],
    isLoading: accountBalancesQuery.isLoading,
    isFetching: accountBalancesQuery.isFetching,
    error: accountBalancesQuery.error,
    refetch: accountBalancesQuery.refetch,
    getBalanceSheetData,
    getIncomeStatementData,
    getCashFlowData,
    getCurrentYearEarnings,
    dateRange,
    realtimeLastEventAt,
  };
}
