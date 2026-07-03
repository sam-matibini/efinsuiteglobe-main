# Memory: logic/financial-reporting-sign-convention-v3
Updated: 2026-01-25

The financial reporting hooks and compilation PDF generator use GAAP/ASPE-compliant sign conventions and asset/liability classification logic.

## Asset/Liability Classification Fix (2026-01-25)

**Problem**: The Compilation Report PDF was incorrectly classifying non-current assets (Vehicles, Furniture & Fixtures, Accumulated Depreciation) as Current Assets. The classification logic used naive text matching instead of the database `is_current` field.

**Root Cause**: 
1. The `AccountBalance` interface in `useFinancialReports.ts` and `useComparativeFinancialReports.ts` was missing the `is_current` field
2. The PDF generation in `generateCompilationPdfEnhanced.ts` used flawed text matching: `a.is_current !== false` evaluates to `true` when `is_current` is `undefined`

**Fix Applied**:
1. Added `is_current: boolean` to `AccountBalance` interface in both hooks
2. Updated account balance mapping to include `is_current: account.is_current ?? true`
3. Rewrote classification logic in PDF generation using a priority-based approach:
   - **Priority 1**: Use the `is_current` database field (primary source of truth)
   - **Priority 2**: Account code prefix (e.g., `1-02` = non-current PPE, `2-02` = non-current liabilities)
   - **Priority 3**: Name-based patterns for PPE items (vehicles, furniture, equipment, accumulated depreciation)

## Sign Convention Rules (Contra-Account Handling)

### Income Accounts
- **Credit-normal** (standard revenue): Adds to revenue total
- **Debit-normal** (contra-revenue like Sales Discounts): Subtracts from revenue total

### Expense Accounts  
- **Debit-normal** (standard expenses): Adds to expense total
- **Credit-normal** (contra-expense): Subtracts from expense total

### Net Income Formula
```
Net Income = Σ(Revenue using sign convention) - Σ(Expenses using sign convention)
```

## Implementation Locations

### Database Function
`public.calculate_period_net_income()` - Uses proper sign convention

### Frontend Hooks
- `src/hooks/useFinancialReports.ts` - Primary financial data with `is_current` field
- `src/hooks/useComparativeFinancialReports.ts` - Comparative data with `is_current` field

### PDF Generation
- `src/lib/generateCompilationPdfEnhanced.ts` - Uses `isNonCurrentAsset()` and `isNonCurrentLiability()` helpers

## Files Modified

### Interfaces Updated
- `AccountBalance` in `useFinancialReports.ts` - Added `is_current: boolean`
- `AccountBalance` in `useComparativeFinancialReports.ts` - Added `is_current: boolean`
- `ComparativeFinancialData` in `generateCompilationPdfEnhanced.ts` - Added `normal_balance` to asset/liability arrays

### Classification Logic
```typescript
// Asset classification (generateCompilationPdfEnhanced.ts)
const isNonCurrentAsset = (a: { name: string; is_current?: boolean; code?: string }) => {
  if (a.is_current === false) return true;
  if (a.is_current === true) return false;
  if (a.code?.startsWith('1-02')) return true;
  // Fallback name patterns for PPE
  return ppePatterns.some(pattern => nameLower.includes(pattern));
};
```

## Dynamic Link Integrity
- Income Statement Net Income → Balance Sheet "Current Year Earnings"
- Income Statement Net Income → Statement of Retained Earnings
- Income Statement Net Income → Cash Flow Statement (Operating Activities starting point)
- All use the shared `calculate_period_net_income()` database function
