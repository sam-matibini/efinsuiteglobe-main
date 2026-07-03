# Memory: features/reports/compilation-zero-balance-filter

The AI Compilation Report Generator includes a **"Hide Zero Balance Accounts"** toggle in the Period tab that filters out accounts with zero balances in BOTH current and prior periods from the generated PDF.

## Implementation Details:
1. **UI Toggle**: Located in `AICompilationDialog.tsx` under the Period tab, after the "Include Comparative Period" option.
2. **Default Behavior**: Enabled by default (`hideZeroBalances: true`).
3. **Export Interface**: `CompilationDisplayOptions { hideZeroBalances: boolean }` is exported from `AICompilationDialog.tsx`.
4. **State Flow**: The display option is passed from the dialog → stored in `AccountantDashboard` state → passed to `executeDownload` → forwarded to `generateEnhancedCompilationPDF()`.
5. **PDF Logic**: The `shouldHideLine()` helper in `generateCompilationPdfEnhanced.ts` checks if both current and prior amounts are within ±$0.01 of zero before hiding the line.

## Usage:
- Accounts like Suspense, inactive clearing accounts, or unused categories will be automatically excluded when both years show zero activity.
- Users can uncheck the toggle to show all accounts regardless of balance.
