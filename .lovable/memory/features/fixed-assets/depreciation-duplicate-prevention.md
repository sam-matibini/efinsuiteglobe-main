# Memory: features/fixed-assets/depreciation-duplicate-prevention
Updated: 2026-02-08

## Duplicate Depreciation Prevention

The `RunAmortizationDialog` now checks for existing depreciation journal entries before allowing users to run amortization for a fiscal year.

### Implementation Details

1. **Pre-check Query**: When the dialog opens or the selected year changes, it queries `journal_entries` for posted entries matching the pattern `DEP-%-{YEAR}`:
   ```typescript
   const { data: existingEntries } = await supabase
     .from('journal_entries')
     .select('reference')
     .eq('organization_id', organization.id)
     .like('reference', `DEP-%-${selectedYear}`)
     .eq('status', 'posted');
   ```

2. **Exclusion Logic**: Assets with existing depreciation entries for the selected year are automatically excluded from the calculation list with the reason: "Already posted for FY {YEAR}"

3. **Reference Format**: Depreciation entries use the format `DEP-{ASSET_NUMBER}-{YEAR}` (e.g., `DEP-CA001-2025`)

### Files Modified
- `src/components/assets/RunAmortizationDialog.tsx`: Added `existingDepreciationRefs` state and pre-check logic

## Half-Year Convention (50% First-Year Rule)

The depreciation calculation applies the CRA CCA half-year convention correctly:

1. **Application**: 50% of normal depreciation is applied to all months in the **first calendar year** of depreciation
2. **Tracking**: Uses `isInFirstDepreciationYear` flag based on `depreciation_start_date` year
3. **Methods Supported**: Both straight-line and declining balance

### Files Modified
- `src/hooks/useFixedAssets.ts`: Simplified and clarified half-year convention logic

## Note 9 PPE Schedule Improvements

### Parentheses for Accumulated Amortization
The AI Compilation Report now displays accumulated amortization values in parentheses per GAAP contra-asset presentation standards:
- Format: `(1,234)` instead of `1,234`

### Period-Specific Accumulated Depreciation
The `buildFixedAssetsNoteData` function now calculates accumulated depreciation as of the report period end date rather than using the current value from the `fixed_assets` table. This ensures that:
- FYE 2023 reports show accumulated depreciation as of 2023 period end
- Prior year comparative columns show correct historical values

### Files Modified
- `src/lib/generateCompilationPdfEnhanced.ts`: Added `formatAccumAmort` helper with parentheses
- `src/pages/AccountantDashboard.tsx`: Added `calculateAccumDepAsOfDate` function for period-specific calculations
