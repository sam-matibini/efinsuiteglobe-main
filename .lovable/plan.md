
## Problem

Reconciling the 2024 GL for Double P Logistics:

| Item | Amount |
|---|---|
| Cash increase (Operating Bank) | +$49,156.50 |
| Net Income (loss) | -$41,510.00 |
| Amortization/depreciation add-back | +$15,816.60 |
| Δ GST/HST ITC (asset) | -$127.13 |
| Δ Due to Shareholder (loan proceeds) | +$215,834.08 |
| Δ Long-Term Bank Loan – Truck Lease | +$121.95 |
| Δ Common Shares issued | +$100.00 |
| **Direct debit posted to Retained Earnings (owner distribution)** | **-$141,079.00** |
| Expected net change | **+$49,156.50 ✓** |

The Cash Flow currently produces an out-of-balance / incorrect 2024 statement because of three defects:

1. **Retained Earnings direct movements are silently dropped.** The equity filter excludes any account whose name contains "retained/earnings/current year/accumulated surplus". That is correct for the NI portion, but the residual movement (RE change minus current-year NI) represents owner distributions/dividends that were posted directly to RE and must appear in Financing. Right now the $141,079 distribution disappears, so CF is off by exactly that amount.

2. **"Long-Term Bank Loan – Truck Lease" is mis-classified as a lease liability** because `isLeaseLiability` matches any 2-01/2-02 account whose name contains the word "lease". That account is a real bank loan and its movement should print as "Proceeds from / Repayment of Long-Term Bank Loan", not "Proceeds from new lease obligations".

3. **Depreciation add-back only matches "depreciation" / "amortization" in the expense name.** The client's expense account is called *Amortization Expense* which works, but there is no guard against also matching accumulated-depreciation-style names that occasionally get created as expense accounts. Add a strict `account_type='expense'` + name/code guard so only real depreciation/amortization *expense* is added back.

## Fix

### 1. `src/pages/CashFlow.tsx` — `calculateCashFlowForPeriod`

- **Tighten lease-liability detection**: require the name to actually contain a lease-obligation phrase (`lease liab`, `lease obligation`, `lease payable`, `capital lease`, `finance lease`, or `current portion of lease`). Remove the loose "code 2-01/2-02 + word 'lease' anywhere" branch that was catching *Long-Term Bank Loan – Truck Lease*.
- **Add owner-distribution recovery from Retained Earnings**: compute
  `reDirectMovement = ΔRetainedEarnings − currentPeriodNetIncome`
  (using signed, normalized balances). If the absolute value is > $0.01, add a Financing line "Owner distributions / dividends (posted to Retained Earnings)" with amount `−reDirectMovement` (a debit to RE = cash out). Include it in `financingTotalCents` and in `financingItems`.
- **Also cover ASNPO wording**: same treatment for accounts whose name contains "accumulated surplus" or "net assets".
- **Depreciation guard**: keep `account_type === 'expense'` filter (already present); additionally exclude any expense account whose name also contains "accumulated" (defensive).

### 2. `src/hooks/useFinancialReports.ts` — `getCashFlowData`

Mirror the same three changes so the on-screen Cash Flow, the dashboard hook, and the compilation PDF all agree:
- Same `isLeaseLiability` tightening.
- Same Retained-Earnings/Net-Assets residual → Financing reclassification.
- Same depreciation guard.

### 3. `src/lib/generateCompilationPdfEnhanced.ts`

- Consume the updated `financingItems` / `nonCashItems` unchanged (no structural change).
- Update the hard-coded label branch that prints "Repayment of Long-Term Bank Loan – Truck Lease" so it now routes through `financingItems` produced by the corrected classifier (label follows the account name; no more "lease obligations" wording for that account).

### 4. Reconciliation assertion

After the three fixes, `calculatedChange` must equal `endingCash − beginningCash` to the cent. Extend the existing `isReconciled` check to log the delta account-by-account when it fails, so future drift is diagnosable.

## Expected 2024 output after fix

```text
Operating
  Net loss                                     (41,510.00)
  Add: Amortization Expense                     15,816.60
  Increase in GST/HST ITC                         (127.13)
Net cash used in operating activities         (25,820.53)

Investing
Net cash from investing activities                    0.00

Financing
  Proceeds from Due to Shareholder             215,834.08
  Proceeds from Long-Term Bank Loan – Truck Lease  121.95
  Issuance of Common Shares                        100.00
  Owner distributions (posted to RE)          (141,079.00)
Net cash from financing activities             74,977.03

Net increase in cash                           49,156.50
Beginning cash                                (45,609.50)
Ending cash                                     3,547.00
```

This ties exactly to the Balance Sheet cash movement.

## Files touched

- `src/pages/CashFlow.tsx`
- `src/hooks/useFinancialReports.ts`
- `src/lib/generateCompilationPdfEnhanced.ts`

No database migration, no journal-entry edits.
