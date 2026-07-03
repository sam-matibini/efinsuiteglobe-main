# Memory: logic/fiscal-year-financial-reports-v2
Updated: 2026-02-08

## Fiscal Year Aware Financial Reports - Complete Implementation

The financial reporting system now correctly handles non-calendar fiscal years across all report types.

### Key Changes (v2)

1. **Database Functions Updated**:
   - `calculate_retained_earnings_statement`: Now derives fiscal year from period END date using org's `fiscal_year_end_month`
   - `get_retained_earnings_rollforward_series`: Now respects org's `fiscal_year_end_month` for FY boundaries
   - Both functions now correctly calculate FY start/end dates for non-calendar years

2. **Frontend Hooks Updated**:
   - `useComparativeFinancialReports.ts`: Added `getFiscalYearForDate` and `getFiscalYearStart` imports
   - `fetchPeriodBalances()`: Now accepts `fiscalYearEndMonth` parameter
   - Query key includes `fiscal_year_end_month` for proper cache invalidation

### Fiscal Year Determination Logic

For a date to determine its fiscal year with fiscal year end month M:
- If the date's month > M, the date belongs to the NEXT calendar year's fiscal year
- Otherwise, it belongs to the current calendar year's fiscal year

Example with September (M=9) FY end:
- Sep 30, 2022 (month 9): 9 is NOT > 9, so FY2022
- Oct 1, 2022 (month 10): 10 > 9, so FY2023
- Mar 15, 2023 (month 3): 3 is NOT > 9, so FY2023

### Fiscal Year Boundaries

For FY2022 with September (9) FY end:
- FY Start: October 1, 2021 (v_fy_end_month + 1 of previous calendar year)
- FY End: September 30, 2022 (last day of v_fy_end_month of fiscal year)

### Data Validation (7995083 Canada Inc)

| Fiscal Year | Opening RE | Net Income | Dividends | Closing RE |
|-------------|-----------|------------|-----------|------------|
| FY2022 | $0.00 | $0.00 | $0.00 | $0.00 |
| FY2023 | $72,523.00* | $15,810.40 | $0.00 | $88,333.40 |
| FY2024 | $88,333.40 | ($36,364.36) | $0.00 | $51,969.04 |
| FY2025 | $51,969.04 | ($12,022.97) | $0.00 | $39,946.07 |

*Note: FY2023 opening includes direct RE posting from JE-0009 on Sep 2, 2022 ($72,523)

### Balance Sheet Equation

For a report as of Sep 30, 2022 (FY2022 end):
- Assets = $72,523
- Liabilities = $0
- Equity = Opening RE ($0) + Net Income ($0) + Direct RE posting ($72,523) = $72,523
- **Balance: $72,523 = $0 + $72,523 ✓**
