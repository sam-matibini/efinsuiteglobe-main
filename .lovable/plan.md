## Goal

Fix the cramped line-item row in the Create Bill dialog (per your screenshot: the Account cell squeezes Qty/Price/Tax% out of view) and give the form more room.

## 1. Account cell shows the code only

- The Account dropdown trigger currently renders `1-01-101-0003 — Savings/Reserve Account`. Change the trigger to display just the account code (e.g. `1-01-101-0003`), monospaced and truncated-free.
- The dropdown list keeps the full `code — name` text plus search on both code and name, so picking an account is still easy.
- Add a tooltip / `title` on the trigger with the full account name so the row stays readable at a glance.
- Shrink the Account column from `w-56` to roughly `w-40`, freeing space for Qty, Price, Tax %, and Amount.

## 2. Expand the Create Bill form

- Widen the dialog from `max-w-3xl` to `max-w-5xl` (still responsive: full width on small screens, capped on large).
- Give the line-items table a horizontal scroll wrapper so nothing ever overlaps on narrow screens.
- Set explicit min-widths on Description (flexible), Qty (`w-16`), Price (`w-24`), Tax % (`w-16`), Amount (`w-28`) so the columns stay aligned.
- Header fields (Vendor / Bill Number / Dates / Terms) go to a 3-column grid on large screens, 1 column on mobile, so the extra width is used rather than leaving a long empty gap.

## Not included

- No changes to bill posting, GL logic, or validation — this is presentation only.

## Technical details

- File: `src/components/bills/CreateBillDialog.tsx`.
- If `SearchableSelect` has no way to render a different trigger label than the option label, add an optional `renderTriggerLabel` (or `triggerLabel`) prop to `src/components/ui/searchable-select.tsx` — additive and backwards compatible, no other call sites affected.
