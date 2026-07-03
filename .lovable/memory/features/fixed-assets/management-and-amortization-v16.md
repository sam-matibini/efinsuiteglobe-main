# Memory: features/fixed-assets/management-and-amortization-v16
Updated: now

Fixed asset book value is calculated as 'acquisition_cost - accumulated_depreciation'. 

1) **Fiscal Year Support**: Depreciation calculations now respect the organization's `fiscal_year_end_month` setting. For example, if fiscal year ends in September (month 9), FY2024 runs from Oct 1, 2023 to Sep 30, 2024. The `generateDepreciationSchedule()` function accepts an optional `fiscalYearEndMonth` parameter, and `getDepreciationForFiscalYear()` provides fiscal-year-aware depreciation totals. Fiscal year utilities are in `src/lib/fiscalYearUtils.ts`.

2) **Half-Year Convention**: The half-year rule applies to the asset's **first fiscal year** of ownership (not calendar year). For 20% declining balance with half-year rule, first FY gets 50% of normal depreciation. Example: Asset acquired Oct 2023 with FY ending Sep 30 → First depreciation in FY2024 at 50% rate.

3) **Amortization & Posting**: The 'RunAmortizationDialog' displays the fiscal year period (e.g., "Oct 2023 - Sep 2024") and posts journal entries dated on the fiscal year end date (e.g., Sep 30, 2024 for FY2024).

4) **Duplicate Prevention**: The system prevents duplicate postings by verifying the existence of 'posted' journal entries with the reference pattern 'DEP-{ASSET_NUMBER}-{YEAR}' before execution.

5) **Validation & Integrity**: Data integrity is enforced via a database trigger 'validate_depreciation_start_date_trigger' and frontend validation, ensuring 'depreciation_start_date' is never earlier than the 'acquisition_date'.

6) **UI Transparency**: The 'RunAmortizationDialog' includes an exclusion alert that identifies assets omitted from a specific schedule with clear explanations.
