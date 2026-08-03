## Goal

No wrongly-mapped row should ever reach the banking transactions table. Every import preview — bank *and* credit card — gets inline row editing plus a type flip, so corrections happen before import.

## Current state (verified)

- `MappingPreviewDialog.tsx` (used only by `StatementExtractionDialog`) already has `rowOverrides`, inline edit, Deposit↔Withdrawal flip, and "apply to all matching rows". This is the good pattern.
- `CreditCardImportDialog.tsx` preview is **read-only**: it renders date / description / amount / type from `classifyCreditCardType` with no way to correct a mis-typed row (e.g. a vendor purchase classified as `payment`), and shows only the first 20 rows.
- `UnifiedImportDialog.tsx` preview is **read-only** too, for both the bank and the credit-card branch, and truncates at 15 rows.

## The work

**1. Shared editable preview component — `src/components/banking/EditableImportPreview.tsx`**

One table used by both import dialogs, driven by a small prop contract:
- Columns: Date, Description, Payee/Payor, Amount, Type (+ Debit/Credit when a bank statement is in split-amount mode).
- Per-row pencil opens inline inputs for date, description, payee, amount.
- Type control:
  - bank → Deposit ↔ Withdrawal flip button.
  - credit card → select over `charge / payment / credit / fee / interest` (the five values `transaction_type` accepts), with a one-click flip between `charge` and `payment` for the common case.
- "Apply this type to all N rows matching this description" for repeat payees (MBFS Auto, MPI Autopac, etc.).
- "Edited" badge per row, per-row reset, global "Reset all edits", and an edited-count summary.
- Scrollable full list (no 15/20 truncation) so a bad row late in the statement can still be found and fixed.

**2. Wire into `CreditCardImportDialog.tsx`**

Replace the read-only preview table with `EditableImportPreview` in credit-card mode. Keep `parsedTransactions` as the parsed baseline and hold corrections in a `rowOverrides` map; `handleImport` maps the **merged** rows, so `transaction_type` and `amount` sent to `onImport` are the corrected values. Amount stays an absolute magnitude — polarity is carried by `transaction_type`, per the existing credit-card convention.

**3. Wire into `UnifiedImportDialog.tsx`**

Same component in both branches. The bank branch flips `transaction_type` between `deposit`/`withdrawal` (and swaps debit/credit in split mode); the credit-card branch uses the five-value type select. `handleImport` submits merged rows for both.

**4. Keep `MappingPreviewDialog.tsx` consistent**

Refactor its preview body onto the shared component so all three surfaces behave identically, preserving its existing override merge, validation-error skipping, and reset behaviour. If the refactor risks its validation flow, the fallback is to leave it as-is and match its UX in the new component — no regression to the extraction path either way.

## Technical notes

- Corrections are UI-state only, applied at the moment of import; no schema change and no new tables.
- Classification defaults still come from `classifyCreditCardType` (description-first, sign-fallback) — this adds a manual override layer on top, it does not change the classifier.
- Nothing in the GL posting path changes; `useCreditCardGL` keeps deriving polarity from `transaction_type`, which is now user-verified.
