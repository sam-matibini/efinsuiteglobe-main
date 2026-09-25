# Memory: logic/report-filter-integrity-v2
Updated: now

Report filters in 'ReportFilters.tsx' and 'useReportFilters.tsx' use a fully controlled component pattern. The `ReportFilters` component does NOT maintain its own date state - it receives dates as props from the parent and immediately calls `onDateRangeChange` when the user modifies dates. This prevents state synchronization bugs where the displayed dates differ from the query dates.

The `useReportFilters` context provides the single source of truth for date ranges across all financial reports. It now includes `fiscalYearEndMonth` and `setFiscalYearEndMonth` to support fiscal-year-aware date presets. Report pages sync this value from the organization's `fiscal_year_end_month` setting via `useEffect`.

Date presets are now fiscal-year-aware:
- "Last Fiscal Year" calculates the previous complete fiscal year (e.g., Oct 1, 2024 - Sep 30, 2025 for September FY end)
- "Fiscal Year to Date" runs from start of current fiscal year to today
- Uses `getFiscalYearStart`, `getFiscalYearEnd`, and `getFiscalYearForDate` from `fiscalYearUtils.ts`

The date preset is dynamically derived from the actual start/end dates using `detectPresetFromDates()`, ensuring the displayed preset always matches the actual filter period.
