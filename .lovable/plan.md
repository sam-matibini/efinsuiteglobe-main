## Problem

The Create Bill dialog (the screen in your picture) writes straight to the `bills` / `bill_lines` tables. It never creates a journal entry, so bills never reach the General Ledger, Trial Balance, or the financial statements. There is also no place to pick which expense account (Chart of Accounts) a line belongs to — the `bill_lines.expense_account_id` column exists but is never filled.

Note: a separate code path (`useBills.createBill`) does post a journal entry, but the dialog does not use it, and that path guesses "the first active expense account" rather than using a chosen account.

## What to build

**1. Account column in the Create Bill dialog**
- Add an "Account" (Chart of Accounts) searchable dropdown to each line item, next to Description / Qty / Price / Tax %.
- Options come from the org's postable expense / COGS / asset accounts (`useAccounts`, excluding header and non-posting accounts).
- Required per line; the last-used account can prefill new lines for speed.
- Save the choice to `bill_lines.expense_account_id`.

**2. Post the bill to the GL on create**
After the bill and its lines are inserted, build one balanced journal entry (`journalType: 'purchase'`, reference `BILL-<bill number>`) using the shared `createJournalEntry` helper:

```text
DR  each line's chosen expense account   line amount (net)
DR  Input tax / ITC account              total tax        (if tax > 0 and configured)
    CR  Accounts Payable                 bill total
```

- Lines carry `vendor_id`, `source_document_type: 'bill'`, `source_document_id`, and the department, so the entry is traceable back to the bill.
- Store the resulting entry id on `bills.journal_entry_id`.
- Pass the journal entry id into the existing Nigerian tax ledger call (`recordBillTaxes`) instead of `null`, so NG tax rows link to the posting.

**3. Fail loudly, don't post silently**
- If Accounts Payable, or the tax account when tax is present, cannot be resolved, block creation with a clear message ("Set the Accounts Payable account in Settings → Chart of Accounts") rather than saving a bill with no GL impact.
- Roll the bill back (delete the just-created bill and lines) if the journal entry fails, so no un-posted bills accumulate.

**4. Share the logic**
Extract the posting into a single `postBillToGL(bill, lines)` helper and have both the dialog and `useBills.createBill` use it, so the two entry points can't drift again. `useBills` keeps its behaviour but uses each line's account when supplied instead of picking an arbitrary expense account.

## Not included (say the word if you want them)
- Backfilling journal entries for bills already created without a GL posting.
- Editing/voiding a bill reversing its journal entry.

## Technical details
- Files: `src/components/bills/CreateBillDialog.tsx`, `src/hooks/useBills.ts`, new `src/lib/postBillToGL.ts`.
- Reuses `createJournalEntry`, `getDefaultAccounts`, `getTaxGlAccounts` from `src/hooks/useJournalEntryCreation.ts` and the existing `SearchableSelect` component.
- No database migration required — `bill_lines.expense_account_id` and `bills.journal_entry_id` already exist.
- Reports read only from posted `journal_entry_lines`, so once the entry posts, Trial Balance, Balance Sheet, and Income Statement pick the bill up automatically.
