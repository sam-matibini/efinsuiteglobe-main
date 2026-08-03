## Problem

In the Edit Bill dialog, the line-items table gives the Tax % column only `w-16`. The header wraps to two lines and the numeric input is clipped, so the tax value is not readable/editable.

## Change (presentation only, `src/components/bills/EditBillDialog.tsx`)

1. Widen the Tax % column from `w-16` to `w-20` and give Qty a little more room (`w-16` → `w-20`).
2. Add `whitespace-nowrap` to the table header cells so "Tax %" stays on one line.
3. Bump the table's `min-w-[820px]` to `min-w-[900px]` so the wider columns don't squeeze Description; the existing `overflow-x-auto` wrapper keeps it usable on narrow screens.
4. Give the Tax % input explicit right-aligned sizing (`w-full text-right`) so the value is never clipped inside the cell.

Optionally mirror the same column widths in `CreateBillDialog.tsx` so both forms stay consistent.

No changes to posting logic, totals, or GL behaviour.
