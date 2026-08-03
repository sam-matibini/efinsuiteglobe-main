## Goal

Replace the free-text "Terms" input on bills with a preset dropdown, and auto-set the Due Date from the selected term.

## Terms options

- Due on receipt (0 days)
- Net 10, Net 15, Net 30, Net 45, Net 60, Net 90
- Custom… (reveals a small text input for a custom label; Due Date stays manually editable)

## Implementation

New shared module `src/lib/billPaymentTerms.ts`:
- `BILL_PAYMENT_TERMS`: array of `{ value, label, days }` covering the options above.
- `getTermDays(label)` helper that maps a stored terms string back to a preset (so existing bills like "Net 30" resolve correctly).

`src/components/bills/CreateBillDialog.tsx`:
- Swap the Terms `Input` for a `Select` populated from `BILL_PAYMENT_TERMS`, plus a "Custom…" entry.
- On term change, recompute `due_date` = bill date + term days (skipped for Custom).
- Also recompute due date when Bill Date changes and a preset term is active.
- Choosing Custom renders an adjacent text input bound to `terms`; Due Date remains user-editable.
- Default stays "Net 30".

`src/components/bills/EditBillDialog.tsx`:
- Same Select, initialised from the bill's saved `terms` (falls back to Custom with the stored text when it isn't a preset).
- Changing the term updates Due Date; existing due date is preserved otherwise.

Stored value in `bills.terms` remains the human-readable label (e.g. "Due on receipt", "Net 45"), so no schema or posting-logic changes are needed.
