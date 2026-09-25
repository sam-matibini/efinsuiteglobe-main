# Memory: features/banking/credit-card-import-sign-convention
Updated: now

Credit card statement imports use **description-first, sign-fallback** classification (NOT amount-sign-first):

## Classifier rule (`src/lib/creditCardImportNormalizer.ts::classifyCreditCardType`)
1. Explicit `Type` column from the source file wins (charge / payment / credit / fee / interest / deposit→payment / debit→charge).
2. Description keyword scan:
   - payment keywords (`payment received`, `pre-auth pmt`, `autopay`, `bill payment`, `online payment`, `thank you`, `paiement`, `transfer to card`, ` pmt `) → `payment`
   - refund keywords (`refund`, `return`, `credit memo`, `reversal`, `chargeback`) → `credit`
   - `interest` / `finance charge` → `interest`
   - `annual fee`, ` fee`, `service charge`, `late fee`, `overlimit` → `fee`
3. Sign fallback only when the description is ambiguous: `amount < 0` → `payment`, otherwise → `charge`.

This prevents vendor purchases that happen to be signed negative on the source statement (e.g. "PART SOURCE #732") from being mis-classified as inbound payments.

## Storage
- Amount is always stored as absolute magnitude.
- `transaction_type` drives GL polarity and UI color (red charge / green payment).

## GL Posting Logic (`useCreditCardGL.ts`)
- **Charges / fees / interest**: DEBIT Expense (or Interest Expense), CREDIT CC Liability (both increase).
- **Payments**: DEBIT CC Liability, CREDIT Bank/Cash (CC balance reduced).
- **Credits / refunds**: DEBIT CC Liability, CREDIT Expense (refund reduces both).

## UI display rule (`src/pages/CreditCardTransactions.tsx`)
The row color/sign trusts `transaction_type` ONLY. Do not re-derive from `amount < 0` or description in the renderer — classification happens once at import time.

## History
- 2026-02-04: 29+ transactions mis-typed as `payment`; fixed by reset-to-pending and re-post.
- 2026-06-25: classifier switched from sign-first to description-first; pending CC rows with vendor-like descriptions backfilled from `payment` → `charge`. Bank/chequing import logic in `UnifiedImportDialog.tsx` (non-CC branch) was NOT touched.
