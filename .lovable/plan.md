# Fix Retained Earnings Statement — Remove non-CoA "Other" lines

## Problem

The current Statement of Retained Earnings shows two lines — **Other additions** and **Other deductions** — that do not correspond to any chart-of-accounts codes. They are a synthetic bucket created by `calculate_retained_earnings_statement` to hold any direct posting hitting the Retained Earnings account (3-01-100-0002) that isn't a `CLOSE-*` system close.

For Sunview Homes & Constructions, the postings behind those lines are:

| Date       | Ref                | Dr        | Cr         | What it really is                    |
|------------|--------------------|-----------|------------|--------------------------------------|
| 2024-01-01 | JE-0007            | 60,743.39 |            | Opening BS setup (prior-year carry)  |
| 2024-12-31 | JE-0008/0009/0010  | 3,309.76  | 2,334.82   | Year-end true-ups (prior periods)    |
| 2024-12-31 | IMP-2024-MRMOZZG4  |           | 195,900.00 | Trial-balance import (opening equity)|
| 2025-12-13 | CC-OB-0001         | 14,164.99 |            | RBC Avion Visa Business opening bal. |

Net 2024 = **134,181.67 Cr** → currently shown as "Other additions" (wrong).
Net 2025 = **14,164.99 Dr** → currently shown as "Other deductions" (wrong).

Neither line maps to a real CoA account, so the statement is not ASPE-compliant.

## Fix — two parts

### 1. Reclass the credit-card opening balance to Due to Shareholders (data fix)

Journal entry `CC-OB-0001` posted the 14,164.99 debit against Retained Earnings. It should have hit **`2-01-120-0002 — Due to Shareholders`** (liability), because the balance represents amounts the company owes the shareholder for personal card charges.

Data change:
- Update the RE line on `CC-OB-0001` to point to account `2-01-120-0002` (Due to Shareholders).
- Keep debit/credit signs unchanged (liability increases via credit — so the entry becomes a credit to Due to Shareholders instead of a debit to RE, matched against the same offset already in the JE).
- Fix the credit-card import routine so future CC opening balances default to Due to Shareholders (or a configurable liability), not Retained Earnings.

### 2. Fold remaining direct-RE postings into Opening Retained Earnings (formula fix)

After the reclass above, the only remaining direct-RE postings for 2024 are prior-year opening / trial-balance-import entries (JE-0007, JE-0008, JE-0009, JE-0010, IMP-2024-MRMOZZG4). Under ASPE these are **opening equity carryforward**, not current-period movements.

Update `calculate_retained_earnings_statement` so:

```
Opening RE(Year N) = calculate_opening_retained_earnings(N)
                   + Σ direct RE postings dated ≤ fiscal_year_start (Year N)
                   + Σ prior-period-adjustment RE postings in Year N flagged as opening
```

Simplest rule that fits Sunview's data and ASPE: **any non-`CLOSE-*` posting to the RE account counts toward Opening RE of the fiscal year it falls in**, not as a current-period movement. Remove the `other_additions` / `other_deductions` outputs entirely (return 0 for both, or drop them from the statement UI).

Resulting 2024 Statement of RE:

```
Opening balance              134,181.67
Net income (loss)             (7,461.12)
Dividends declared           (54,000.00)
Closing balance               72,720.55   ← flows into 2025 opening
```

2025 opening becomes **72,720.55**, restoring true year-over-year continuity.

## Deliverables

1. **Migration** — new `calculate_retained_earnings_statement` that folds direct RE postings into opening balance and returns `other_additions = 0`, `other_deductions = 0`.
2. **Data patch** — reclass `CC-OB-0001` line from `3-01-100-0002` to `2-01-120-0002`.
3. **Import code fix** — `src/lib/creditCardImportNormalizer.ts` (and any callers) route opening balances to Due to Shareholders liability, not RE.
4. **UI cleanup** — remove "Other additions" and "Other deductions" rows from Statement of RE in `src/pages/BalanceSheet.tsx` (both live view and Excel export) since they will always be 0 after the formula fix.
5. **Verify** Balance Sheet still balances for both 2024 and 2025 with the new opening RE.

## Questions before I build

1. Confirm reclassing **all** the 2024 direct-RE postings (including the 12-31 true-ups JE-0008/0009/0010 for $-2,334.82 net) into Opening RE is what you want. The alternative is to keep only the 2024-01-01 and TB-import entries as opening and treat the year-end true-ups as ASPE prior-period adjustments (which is a legitimate SoRE line, but requires a `prior_period_adjustment` flag on journal entries — not currently in the schema).
2. Confirm the CC-OB-0001 reclass target is **`2-01-120-0002 — Due to Shareholders`** (only match found in Sunview's CoA).
