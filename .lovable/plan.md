## Plan

1. **Fix the visible Balance Sheet total**
   - Update `src/pages/BalanceSheet.tsx` so comparative **Total for Equity** uses the same corrected equity formula already used by the detailed equity rows:
     - Share capital / valid non-RE equity accounts
     - plus Statement of Retained Earnings closing balance
     - excluding Retained Earnings ledger balance, Current Year Earnings, dividends, drawings, treasury stock, and other contra-equity accounts that are already included in retained earnings.

2. **Remove duplicate equity-total formulas**
   - Replace the repeated inline comparative equity calculations in the rendered table with one shared helper / computed source of truth.
   - Ensure these all match exactly:
     - Collapsed Equity total
     - Expanded `Total for Equity`
     - `Total for Liabilities & Equity`
     - Exported report totals

3. **Validate Sunview Homes & Constructions numbers**
   - Confirm the 2024 comparative column shows:
     - Common Shares: `$100.00`
     - Retained Earnings: `$16,356.78`
     - Total for Equity: `$16,456.78`
     - Liabilities: `$112,426.62`
     - Total Liabilities & Equity: `$128,883.40`
   - Confirm the highlighted wrong value `($123,543.22)` no longer appears.

4. **Database integrity check**
   - Run read-only checks against the retained earnings RPC and balance totals for the affected organization/period.
   - Only add a database migration if the DB function still contains a formula defect; otherwise keep this as a frontend reporting formula correction so ledger data is not unnecessarily changed.

## Technical note

The current detailed equity rows are already correct, but the comparative total row still recalculates equity separately and includes dividend/drawing contra-equity again. That double-counts the dividend effect and turns the correct `$16,456.78` equity total into `($123,543.22)`. The fix is to make every total row use the same ASPE-compliant equity calculation.