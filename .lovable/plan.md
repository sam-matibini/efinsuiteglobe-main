## Problem

Editing a bank transaction (date, description, amount, reference, payee) via `EditTransactionDialog` currently calls `updateTransaction` in `useBankTransactions.ts`, which only patches the `bank_transactions` row. If the transaction was already posted to the GL (has `journal_entry_id`), the linked journal entry keeps the old amount/date/description, so the Trial Balance, Balance Sheet, and Income Statement never reflect the correction — exactly the $100,000 case in the screenshot.

The same gap exists for `useCreditCardTransactions.ts` / `EditCreditCardTransactionDialog`.

## Goal

Make bank & credit-card transaction edits GL-safe: when a posted transaction is edited, reverse and re-post the linked JE so ledgers, TB, and financial statements stay accurate — without forcing users into manual JEs.

## Approach

Reuse the existing `reverseLinkedJournalEntry` + `recalculateAndInvalidate` helpers in `useGLPropagation.ts` (already used by `categorizeTransaction` and delete flows) so the logic mirrors what happens when re-categorizing.

### Fields that require GL re-post
Any change to: `transaction_date`, `amount`, `description`, `reference`, `payee_payor`, `gl_account_id`, `category`, or the transaction "type" (deposit/withdrawal).

Non-financial fields (notes, tags, memo-only) can update in place.

### New `updateTransaction` flow (bank + credit card, symmetrical)

1. Load current row (including `journal_entry_id`, `gl_account_id`, org id, current values).
2. Detect whether any GL-relevant field changed.
3. If not posted (`journal_entry_id` is null) → plain UPDATE, done.
4. If posted and a GL-relevant field changed:
   a. Call `reverseLinkedJournalEntry(...)` — creates the REV-* entry, marks original reversed, unlinks.
   b. UPDATE the transaction row with the new values, set `status='pending'`, `journal_entry_id=null`.
   c. If the transaction still has a `gl_account_id` (i.e. was previously categorized), immediately re-post a fresh JE with the corrected values, using the same debit/credit convention already in `categorizeTransaction` (deposit vs withdrawal based on amount sign, bank-side vs category-side lines, `BANK-<id>` reference, payee memo).
   d. Link the new `journal_entry_id` back on the transaction.
   e. Call `recalculateAndInvalidate(orgId, queryClient)` so TB / BS / IS refresh.
5. If posted but only non-GL fields changed → plain UPDATE + invalidate `bank-transactions`.

Wrap the reverse + update + re-post in try/catch; on failure toast and let the caller see the error. No SQL migrations — all logic is client-side and uses existing tables/RPCs.

### Files to change

- `src/hooks/useBankTransactions.ts` — replace the body of `updateTransaction` with the flow above; import the two helpers (already imported at top of file).
- `src/hooks/useCreditCardTransactions.ts` — mirror the same flow (credit card sign convention: charge = debit expense/credit CC liability; payment = debit CC/credit bank-clearing). Reuse existing posting logic already present in `categorizeCC` there.
- `src/components/banking/EditTransactionDialog.tsx` — no structural change; add a small inline notice "Editing will reverse and re-post the linked journal entry to keep the GL in sync." shown only when `journal_entry_id` is set.
- `src/components/banking/EditCreditCardTransactionDialog.tsx` — same inline notice.

### Out of scope

- Editing an individual line of an already-posted manual JE (that path already exists via journal UI).
- Bulk edit. Single-row edit only.
- Schema changes.

## Verification

1. Open the JE from the screenshot's bank transaction, confirm original amount posted.
2. Edit the bank transaction amount from $100,000 → $95,000 and save.
3. Confirm: original JE marked `reversed`, a `REV-*` entry exists, a fresh JE with $95,000 is linked to the transaction, and Trial Balance / Balance Sheet / Operating Bank Account balance all reflect $95,000.
4. Edit only the description → confirm no reversal happens (plain update).
5. Repeat 2–4 for a credit card transaction.