# Memory: features/banking/rules-and-tax-logic
Updated: 2026-02-09

## Transaction Rules Engine and Tax Routing

The transaction rules engine (`transactionMatcher.ts`) automates GL posting and sales tax application. For tax routing, it utilizes split GL account fields: `taxCollectedGlAccountId` (for Deposits/Sales) and `taxPaidGlAccountId` (for Withdrawals/Expenses/Purchases). This ensures tax is correctly routed to Liabilities (Collected) or Assets (ITC/Paid) based on the transaction type across both bank and credit card modules.

### Journal Entry Reference Generation
- Bank transactions: `BANK-` prefix + transaction UUID (uppercase)
- Credit card transactions: `CC-` prefix + transaction UUID (uppercase)
- Handles derived tax codes by verifying database existence before saving to maintain foreign key integrity

### Critical: Avoiding Double-Posting Inter-Account Transfers

When a transfer between two bank accounts (e.g., Operating → Shareholder) appears on BOTH bank statements, the system must ensure only ONE journal entry is created.

**Implementation (useBankingGL.ts + usePaymentMatching.ts):**
The `usePostTransactionToGL` and `useBulkPostToGL` hooks now include three pre-checks before creating a new JE:

1. **Idempotency check**: Skip if transaction already has a `journal_entry_id`
2. **CC Payment check**: If GL account belongs to a credit card, search for existing CC-side payment JEs
3. **Inter-account transfer check** (NEW): If GL account belongs to another bank account (`isBankGLAccount()`), search for an existing deposit JE on that bank account with matching amount (`findExistingBankTransferJE()`)

If a match is found, the bank transaction is linked to the existing JE via `linkBankTransactionToExistingTransfer()` instead of creating a duplicate.

### Critical: Avoiding Double-Posting CC Payments

When a credit card payment appears in BOTH the bank statement (as a withdrawal) AND the credit card statement (as a payment/credit), the system must ensure only ONE journal entry is created that debits the CC Payable account.

**Matching Criteria (per user preference):**
- Exact amount match only (within $0.01 rounding tolerance)
- No date window requirement

### Tax Code GL Account Linking
Sales tax settings must have both:
- `gl_collected_account_id` - For sales/deposits (GST/HST Payable - Liability)
- `gl_paid_account_id` - For purchases/expenses (GST/HST ITC - Asset)

### Data Quality Issues Identified (2026-02-09)
1. **Inter-account transfer double-posting**: Operating Bank withdrawals to Shareholder Account GL were creating duplicate JEs because the system didn't check if the Shareholder bank module already posted the deposit side. Fixed with `isBankGLAccount()` + `findExistingBankTransferJE()`.
2. **CORR-XFER entries**: Manual corrections created additional postings without reversing originals, leading to triple-posting.
3. **Amount mismatches**: Bank statements showed different amounts for the same transfer number on each side (e.g., $2,090 vs $3,646.92 for transfer #109508).
4. **Reclassification JE (CORR-RECLASS-001)**: Created to correct $6,300.93 excess debits in Shareholder Account, moving them to Shareholder Loans liability.
