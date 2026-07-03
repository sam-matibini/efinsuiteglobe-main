# Memory: features/reports/compilation-engine-v10
Updated: now

The AI Compilation report (AICompilationDialog, generateCompilationPdfEnhanced.ts, AccountantDashboard.tsx) enforces GAAP/ASPE standards for financial reporting and note disclosures.

1) **Formatting**: Contra-asset accounts (e.g., accumulated depreciation) are strictly displayed with parentheses—e.g., (17,443)—across current and comparative periods. 
2) **Contra-Account Handling in Totals**: The PDF Balance Sheet section totals now correctly apply sign logic based on `normal_balance`: debit-normal accounts ADD to totals, credit-normal accounts (contra-assets like accumulated depreciation) SUBTRACT from totals. This ensures Total PPE = Cost - Accumulated Depreciation, not Cost + Accumulated Depreciation.
3) **PPE Note Alignment**: The Property, Plant, and Equipment note uses **direct summation from the `fixed_assets` table** (per-asset `accumulated_depreciation` field) grouped by asset class, instead of GL account lookups. This avoids mismatches when GL accounts group depreciation differently than the note's asset classification. Prior year accumulated depreciation is computed via `generateDepreciationSchedule` filtered to the prior period end date.
4) **Reporting Logic**: The engine matches accounts across periods via codes or ASPE categories, suppressing zero-activity accounts when 'hideZeroBalances' is enabled and displaying dashes for missing periods. It performs year-over-year variance detection to suggest relevant note disclosures.
5) **Initialization**: Report periods (Start Date, End Date, and Comparative Period End) are automatically derived from the organization's fiscal year settings during dialog initialization to ensure consistency with the general ledger.
6) **Prior Year Data**: Prior year Balance Sheet data now includes the `normal_balance` field to ensure proper contra-account handling in comparative views.
