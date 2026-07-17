## Goal
Add a **"Post to Banking"** gateway in AI Sheets that (a) auto-detects whether the loaded statement is a **credit card** or **bank** statement, (b) routes rows into the correct destination table (`credit_card_transactions` or `bank_transactions`), and (c) maps AI-Sheets columns (including split **Charge / Payment** columns like the uploaded screenshot) to the target schema without manual re-mapping in most cases.

Today, AI Sheets already has `Map & Import → Bank` and `Map & Import → Credit Card`, but:
- The user must pick the destination manually.
- Auto-mapping is name-similarity only; it does **not** understand split **Charge/Debit** vs **Payment/Credit** columns, so signs/types are wrong for CC statements.
- `Payer/Payee`, `Reference`, `Posted Date`, `MCC` are inconsistently mapped.

## Changes

### 1. Statement type detection — `src/components/dashboard/AISheets.tsx`
Add `detectStatementType(columns, rows, sourceFile)`:
- Credit card if any of: columns include both a charge-side (`Charge`, `Debit`, `Purchases`) and payment-side (`Payment`, `Credit`, `Payments/Credits`); or filename contains `credit`, `visa`, `mastercard`, `amex`, `card`, `statement-####`; or a `Posted Date` / `Transaction Date` pair exists.
- Otherwise treat as bank.
- Returned as `{ kind: 'bank' | 'creditcard', confidence, reasons[] }`.

### 2. Unified "Post to Banking" gateway button
Replace the two dropdown items with a single primary action **Post to Banking** (keep advanced menu for manual override):
- On click: run detection, open the mapping dialog pre-set to the detected target and pre-selected account/card (first active `bank_account` or `credit_card`, matching last-used if available).
- Show a small badge in the dialog header: `Detected: Credit Card statement (Charge/Payment columns)` with a `Switch to Bank` link.

### 3. Enhanced auto-mapping (covers uploaded statement shape)
Extend `openMappingDialog` auto-mapper with a header-alias table applied before name-similarity fallback:

```
transaction_date  ← Date, Trans Date, Transaction Date
posted_date       ← Posted, Posted Date, Posting Date
description       ← Description, Details, Narrative, Memo
payee_payor       ← Payer/Payee, Payee, Payer, Merchant, Counterparty
reference         ← Reference, Ref, Ref #, Cheque, Check No
category          ← Category, Type
merchant_category_code ← MCC, Merchant Category
charge_column     ← Charge, Debit, Withdrawal, Purchases, Amount Out
payment_column    ← Payment, Credit, Deposit, Payments/Credits, Amount In
amount            ← Amount (single-column fallback)
```

`charge_column` / `payment_column` are **virtual targets** used only when the sheet has split columns.

### 4. Amount reconciliation in `handleImportWithMapping`
Before building the payload, collapse split columns into signed `amount` + correct `transaction_type`:

- **Credit card path** (sign convention per project memory `credit-card-import-sign-convention`):
  - If `charge_column` mapped: `amount = |charge|`, `transaction_type = 'charge'`.
  - Else if `payment_column` mapped: `amount = |payment|`, `transaction_type = 'payment'`.
  - Else fallback to single `amount` (positive → charge, negative → payment).
- **Bank path**:
  - If split columns: `withdrawal → withdrawal`, `deposit → deposit`.
  - Else single amount: positive → deposit, negative → withdrawal.

Skip rows where both charge and payment are empty/zero (statement subtotal rows).

### 5. Preview panel in the mapping dialog
Add a compact 5-row preview under the mapping grid showing the resolved `date | description | payee_payor | amount | type` so the user can visually confirm signs before posting. No new dialog — inline in the existing `mappingDialogOpen` sheet.

### 6. No schema / edge-function changes
`bank_transactions` and `credit_card_transactions` already accept every field used. Posting continues to go through existing `importBankTx` / `importCcTx` hooks so GL journal creation and RLS remain intact.

## Files touched
- `src/components/dashboard/AISheets.tsx` — detection, unified button, alias-based auto-map, split-column reconciliation, inline preview.

## Out of scope
- No changes to Gemini extraction prompts (Phase 11 already added `payer_payee`).
- No new DB tables, migrations, or edge functions.
- No changes to the existing standalone `StatementExtractionDialog` flow.
- No historical backfill.
