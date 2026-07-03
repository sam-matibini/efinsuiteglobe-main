# Memory: logic/fiscal-year-report-filters-v1
Updated: now

## Fiscal Year Aware Report Filters

The report filtering system (`useReportFilters` hook and `ReportFilters` component) is now fully fiscal-year-aware.

### Key Changes

1. **Fiscal Year End Month Integration**:
   - The `useReportFilters` context now includes `fiscalYearEndMonth` and `setFiscalYearEndMonth`
   - Report pages sync this value from the organization's `fiscal_year_end_month` setting via `useEffect`

2. **Date Presets**:
   - "Last Year" → "Last Fiscal Year": Calculates the previous complete fiscal year based on organization settings
   - "Year to Date" → "Fiscal Year to Date": From start of current fiscal year to today
   - Example for September FY end (month 9):
     - FY2025 runs Oct 1, 2024 → Sep 30, 2025
     - "Last Fiscal Year" for current date Feb 2026 would be FY2025 (Oct 1, 2024 - Sep 30, 2025)

3. **Affected Components**:
   - `src/hooks/useReportFilters.tsx`: Provider with fiscal year state
   - `src/components/reports/ReportFilters.tsx`: Date preset calculations
   - `src/pages/IncomeStatement.tsx`: Syncs org fiscal year
   - `src/pages/BalanceSheet.tsx`: Syncs org fiscal year
   - `src/pages/ChangesInEquity.tsx`: Syncs org fiscal year
   - `src/pages/TrialBalance.tsx`: Syncs org fiscal year

4. **Utility Functions** (`src/lib/fiscalYearUtils.ts`):
   - `getFiscalYearStart(fiscalYear, fiscalYearEndMonth)`: Returns fiscal year start date
   - `getFiscalYearEnd(fiscalYear, fiscalYearEndMonth)`: Returns fiscal year end date
   - `getFiscalYearForDate(date, fiscalYearEndMonth)`: Determines which fiscal year a date belongs to

### Configuration

Organizations set their fiscal year end month in Settings (1-12). This affects:
- Report date presets and defaults
- Fiscal year close calculations
- Financial reporting periods
