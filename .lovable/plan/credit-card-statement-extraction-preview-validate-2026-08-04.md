# Credit Card Statement Extraction — Preview & Validate

Scope: credit card statement extraction/import only. Bank statement behaviour stays exactly as it is today.

## What exists today

Two credit card paths already reach a preview screen:

1. **Column-mapping import** (`MappingPreviewDialog`, statementType `creditcard`) — has a row flip button, an expandable inline field editor, and "Apply this type to all N matching rows". But the type badge and flip tooltip still read **Deposit / Withdrawal**, which is bank language and is exactly what makes credit card rows look mis-mapped.
2. **Direct CSV/parsed import** (`CreditCardImportDialog` → `EditableImportPreview` in `credit-card` mode) — has a charge/payment type select, a flip button, inline edit of date/description/payee/amount, and "Apply this type to all matching rows". Missing: separate **Debit / Credit** editing, and applying a *field* correction (not just the type) across matching rows.

## What will change

### 1. Credit-card wording in the mapping preview
In credit-card mode only:
- Type badge shows **Charge** (red) or **Payment** (green) instead of Withdrawal / Deposit.
- Flip button tooltip becomes "Flip this row between Charge and Payment".
- Dialog description explains the credit card convention (charge increases the card balance, payment reduces it).
- Bank mode keeps Deposit / Withdrawal.

### 2. One-click flip on every credit card row
The flip control moves out of the "type known" branch so rows where the type could not be derived still get a flip/Set-as-Charge control, and the flip is available directly in the row (not only inside the expanded editor).

### 3. Inline editor covers date / description / payee / debit / credit / amount
- In credit-card mode the expanded editor always renders **Date, Description, Payee/Payor, Debit, Credit, Amount** fields, even when the source file did not map a debit or credit column — editing Debit or Credit recomputes the signed amount (`debit - credit`), and editing Amount recomputes debit/credit.
- Same field set is added to `EditableImportPreview` in credit-card mode: a Debit and Credit pair alongside the existing amount, kept in sync with the row's charge/payment type.

### 4. "Apply to all matching rows" for corrections, not just type
- Matching is by normalized description (falling back to payee) as it is today.
- The expanded editor gains an **Apply to all N matching rows** control that applies the current row's edited payee, category and type to every matching row — amounts and dates stay per-row so totals are never silently overwritten.
- The existing type-only apply stays as-is.

### 5. Edited/summary feedback
Rows changed by any of the above keep the existing amber **Edited** badge, per-row reset, and "Reset all edits", so a bad bulk apply is always reversible before import.

## Technical notes

- `src/components/banking/MappingPreviewDialog.tsx`: credit-card label map for the type column, always-visible flip, extended editor field list with debit/credit↔amount recompute, and a `applyFieldsToMatching` helper writing into the existing `rowOverrides` state.
- `src/components/banking/EditableImportPreview.tsx`: credit-card-only debit/credit inputs derived from `amount` + `type`, plus an apply-to-matching action for payee/type.
- `src/components/banking/CreditCardImportDialog.tsx`: no logic change, just passes through the richer preview.
- No database, edge function, or bank-import changes.
