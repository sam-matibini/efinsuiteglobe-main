# Plan: Clean up prior-year data on Sunview Homes & Construction Inc.

## What I found

I checked every dated table for the Sunview organization (`a999d6ac-b2cd-44bc-9b8c-f5ded4f81cf6`).

**No records actually exist with 2023 dates** — journal entries, invoices, bills, expenses, bank transactions, and credit card transactions all have zero rows dated in 2023. Account `opening_balance` is also zero everywhere and there are no `fiscal_year_closes` rows.

However, there is a clear block of prior-year data that does not match anything the user entered:

| Source | Count | Dates | Amount |
|---|---|---|---|
| Credit card txns on card ending 2525 | 327 | Jan–Dec **2001** | $293,832.21 |
| Journal entries generated from those charges | 826 posted JEs | Dec 2001 range | $292,871.15 Dr = $292,871.15 Cr |

All 327 charges were bulk‑inserted in a single burst at 2026‑07‑10 08:15:37 UTC. They are not tied to any `import_batches` row (the only user import is the trial‑balance CSV posted 2026‑07‑15). Card 4969 and all bank/JE activity for 2024–2026 look normal and consistent with what you entered.

My read: the "2023" you referenced is this pre‑period block (the app records them as 2001 due to a bad date parse on that credit-card import). It is showing up as prior‑period activity in the Balance Sheet.

## What I'll do

1. **Delete the 826 journal entries** created from card 2525's 2001 charges (and their `journal_entry_lines`) — identified by `reference LIKE 'CC-%'` and matching `journal_entry_id` on those credit-card transactions.
2. **Delete the 327 credit_card_transactions** on card 2525 (`664423aa-373c-489f-b71d-38d6091d7b18`).
3. **Leave card 2525 itself in place** (the card record is empty of history but keeps your setup); say so and let you delete it separately if you want.
4. **Run the balance recalculation** (same logic as `useRecalculateBalances`) to reset every account's `current_balance` from the remaining posted journal entries so the Balance Sheet, Trial Balance, and Retained Earnings statement match the cleaned ledger.
5. Verify: re-check that no rows in any table have `entry_date`/`transaction_date`/etc. before 2024 for this org, and print a short before/after summary.

## What I'll NOT touch

- Trial-balance import from 2026‑07‑15 (22 rows).
- 2024–2026 journal entries, bank transactions, invoices, bills, expenses (all consistent with your activity).
- Card 4969 and its 130 transactions.
- Any other organization.

## Confirm before I run

You said "2023" but the actual bad data is dated 2001 on card 2525 — same block, wrong displayed year. If you meant something different (e.g. you want me to keep the 2001 charges and only wipe something else), tell me now; otherwise I'll proceed to delete the 2001 CC charges + their journal entries and resync balances.
