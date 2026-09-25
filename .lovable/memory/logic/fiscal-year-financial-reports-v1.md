# Memory: logic/fiscal-year-financial-reports-v1
Updated: now

## Fiscal Year Aware Financial Reports

The financial reporting system now correctly handles non-calendar fiscal years.

### Key Components Updated

1. **useFinancialReports.ts Hook**:
   - Now imports and uses `getFiscalYearForDate` and `getFiscalYearStart` from `fiscalYearUtils.ts`
   - Gets `fiscal_year_end_month` from the organization context
   - Calculates correct fiscal year boundaries for:
     - Report fiscal year determination
     - Fiscal year start date for period filtering
     - Retained earnings opening balance calculations

2. **calculate_opening_retained_earnings RPC**:
   - Updated to read `fiscal_year_end_month` from the organization
   - Correctly calculates `v_current_fy_start` and `v_prior_fy_end` dates
   - For September FY end (month 9):
     - FY2022 = Oct 1, 2021 - Sep 30, 2022
     - FY2023 = Oct 1, 2022 - Sep 30, 2023
   - Prior year activity is filtered by `je.entry_date < v_current_fy_start`

### Fiscal Year Determination Logic

For a date to determine its fiscal year with fiscal year end month M:
- If the date's month > M, the date belongs to the NEXT calendar year's fiscal year
- Otherwise, it belongs to the current calendar year's fiscal year

Example with September (M=9) FY end:
- Sep 30, 2022 (month 9): 9 is NOT > 9, so FY2022
- Oct 1, 2022 (month 10): 10 > 9, so FY2023
- Mar 15, 2023 (month 3): 3 is NOT > 9, so FY2023

### Balance Sheet Equation

For a report as of Sep 30, 2022 (FY2022 end):
- Assets = sum of all posted asset transactions up to Sep 30, 2022
- Liabilities = sum of all posted liability transactions up to Sep 30, 2022
- Equity = Opening RE (from entries before FY2022 start) + RE activity in FY2022
- Current Year Earnings = Net income for FY2022 period (Oct 1, 2021 - Sep 30, 2022)
- Balance: Assets = Liabilities + Equity + Current Year Earnings
