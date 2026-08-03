## Goal

On `/purchases/bills`, the row menu currently has three dead items — **View Bill**, **Edit**, and **Void Bill** (confirmed: those `DropdownMenuItem`s in `src/pages/Bills.tsx` have no `onClick`). **Share** and **Attach / Analyze Documents** already work. Make all five functional, with edits and voids kept in sync with the General Ledger.

## What gets built

**1. View Bill (read-only detail dialog)**
New `src/components/bills/ViewBillDialog.tsx`:
- Header: bill number, vendor, bill date, due date, status badge, currency-aware totals (same `formatCurrency` locale logic already used on the page).
- Line items table from `bill_lines` (description, GL account code, qty, unit price, tax %, amount).
- Totals block: subtotal, tax, total, amount paid, balance due.
- Notes/terms, plus a link to the linked journal entry (`bills.journal_entry_id`) so users can trace the posting.
- Print/Download button reusing the existing document print pattern (Blob URL, not `data:`).

**2. Edit Bill (GL-safe)**
New `src/components/bills/EditBillDialog.tsx`, built by reusing the `CreateBillDialog` form layout (vendor, dates, terms, notes, line items with `SearchableSelect` GL account showing code as `triggerLabel`):
- Loads the bill + its `bill_lines`.
- Blocks editing of `paid` and `void` bills; warns when a bill is partially paid (new total must be ≥ amount already paid).
- On save (single transactional flow with rollback on failure):
  1. Update `bills` header + replace `bill_lines`.
  2. Reverse the existing linked journal entry (`journal_entry_id`) — same reversal-then-repost approach already used for transaction edits.
  3. Re-post via `postBillToGL` with the new lines, and store the new `journal_entry_id`.
  4. Recompute `balance_due = total - amount_paid`.
- Result: GL, Trial Balance and financial statements always reflect the edited bill.

**3. Void Bill**
New `voidBill` mutation in `src/hooks/useBills.ts`:
- Confirmation dialog (`AlertDialog`) explaining the GL impact.
- Rejects voiding when `amount_paid > 0` (asks the user to reverse the payment first).
- Reverses the linked journal entry, sets `status = 'void'`, `balance_due = 0`, records void metadata.
- Adds a `void` entry to the page's status filter + `statusConfig` so voided bills render with a muted/destructive badge.

**4. Wiring in `src/pages/Bills.tsx`**
- `viewBill` / `editBill` / `voidBill` state, `onClick` handlers on the three menu items, and the three new dialogs mounted at the bottom next to the existing share/attachments dialogs.
- All mutating items stay hidden under the existing `!isReadOnly` guard; Edit/Void additionally hidden for `paid`/`void` bills.

## Technical notes

- No schema changes needed: `bills` already has `journal_entry_id`, `status`, `deleted_at`; `bill_lines` already carries `expense_account_id`, qty, price, tax.
- Reversal uses the existing `createJournalEntry` helper to write a mirrored entry rather than deleting history, preserving the audit trail.
- Currency formatting continues to come from `getCountryLocalization` / `getLocaleForCountry`, so Naira/Kwacha/etc. stay correct.
