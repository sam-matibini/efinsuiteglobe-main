# Memory: features/reports/statement-of-retained-earnings-standard
Updated: 2026-01-23

The 'Statement of Retained Earnings (Deficit)' is integrated into the Balance Sheet (below 'Total for Liabilities & Equities'), compliant with CRA Schedule 100, ASPE, and IFRS. It tracks Opening Balance (GIFI 3660), Net Income/Loss (GIFI 3680), and Dividends (GIFI 3700) to arrive at the Closing Balance (GIFI 3849). Data is fetched via the 'calculate_retained_earnings_statement' RPC and the 'useRetainedEarningsStatement' hook, supporting multi-org/multi-country localization and comparative years (2023/2024). Opening balances for the initial year of operations (e.g., FYE2023) are explicitly set to zero if no prior year data exists.

New table `retained_earnings_statement`:
- `organization_id` - Multi-organization support
- `fiscal_year` - Year for the statement
- `opening_balance` - GIFI 3660
- `net_income_loss` - GIFI 3680 (dynamically calculated)
- `dividends_declared` - Deductions from RE
- `closing_balance` - GIFI 3849 (computed column)
- `country_code` - Multi-country support (CA, US, ZM, KE, BI)
- `currency_code` - Localized currency

### Database Function

`calculate_retained_earnings_statement(org_id, start_date, end_date)`:
- Uses existing `calculate_opening_retained_earnings()` for opening balance
- Uses existing `calculate_period_net_income()` for net income
- Calculates dividends from equity accounts with `equity_type = 'dividends'`
- Returns opening, net income, dividends, adjustments, closing

### Hook

`useRetainedEarningsStatement(currentPeriod, comparisonPeriods)`:
- Fetches RE statement for current and all comparison periods
- Returns `currentStatement` and `comparativeStatements[]`
- Used in `BalanceSheet.tsx` to render the section

### Link to Balance Sheet

The Closing Balance of Retained Earnings links to:
- Retained Earnings line in Shareholders' Equity section (3-00-201)
- Ensures equation: **RE(Closing) = RE(Opening) + Net Income - Dividends**
- Year-over-year continuity: **RE(Opening, Year N) = RE(Closing, Year N-1)**

### Multi-Country Support

The statement table supports:
- `country_code`: CA, US, ZM, KE, BI
- `currency_code`: CAD, USD, ZMW, KES, BIF
- All organizations can generate localized RE statements
