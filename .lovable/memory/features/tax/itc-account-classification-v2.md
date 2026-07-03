# Memory: features/tax/itc-account-classification-v2
Updated: 2026-02-09

## GST/HST Account Classifications (Canadian Tax System)

The Canadian tax system requires strict account type classification for accurate financial reporting and CRA compliance:

### GST/HST Payable (Liability - Credit Normal)
- **Account Type**: `liability`
- **Normal Balance**: `credit`
- **Code Pattern**: `2-01-110-XXXX` or `2-01-140-XXXX`
- **Purpose**: Tax COLLECTED on sales, owed to CRA
- **Posting**: CREDIT when collecting tax on sales/deposits

### GST/HST Input Tax Credits (ITC) (Asset - Debit Normal)
- **Account Type**: `asset`
- **Normal Balance**: `debit`
- **Code Pattern**: `1-01-120-XXXX` (ideal) or `1-01-104-XXXX`, `1-01-150-XXXX`
- **Purpose**: Tax PAID on purchases, reclaimable from CRA
- **Posting**: DEBIT when paying tax on purchases/withdrawals

## Transaction Rule Tax Routing Logic

The `useRuleAnalysis.ts` hook routes tax to the correct GL account based on transaction type:

```typescript
// Determine the correct tax GL account based on transaction type
const effectiveTaxGlAccountId = isDeposit 
  ? (taxCollectedGlAccountId || taxGlAccountId)  // Sales -> Payable (liability)
  : (taxPaidGlAccountId || taxGlAccountId);       // Expenses -> ITC (asset)
```

### Key Implementation Points

1. **RuleAction Interface**: Stores BOTH `taxCollectedGlAccountId` and `taxPaidGlAccountId`
2. **TransactionRuleDialog.tsx**: Captures both GL accounts from the selected tax code
3. **useRuleAnalysis.ts**: Routes bank transactions based on type (deposit vs withdrawal)
4. **useCreditCardRuleAnalysis.ts**: Routes CC transactions based on type:
   - **Charges (expenses)**: Uses `taxPaidGlAccountId` (GST/HST ITC - asset)
   - **Payments/Credits**: Uses `taxCollectedGlAccountId` (GST/HST Payable - liability)
5. **useBankingGL.ts**: Uses `gl_paid_account_id` for withdrawals, `gl_collected_account_id` for deposits
6. **useCreditCardGL.ts**: Uses `gl_paid_account_id` for charges (purchases)
7. **useSalesTax.ts**: Derived HST/PST codes inherit GL accounts from `sales_tax_settings`

### Sales Tax Settings GL Account Linking

Organizations must have these accounts linked in `sales_tax_settings`:
- `gst_collected_account_id`: Points to GST/HST Payable liability account
- `gst_paid_account_id`: Points to GST/HST ITC asset account
- `pst_collected_account_id`: Points to PST Payable liability account (where applicable)
- `pst_paid_account_id`: Points to PST ITC/expense account (QST only is recoverable)

### Net Tax Calculation

On tax returns:
```
Net GST/HST = GST/HST Payable (liability balance) - GST/HST ITC (asset balance)
```
- If positive: Amount owed to CRA
- If negative: Refund due from CRA

### Journal Entry Examples

**Withdrawal (Expense) with 13% HST:**
```
Dr. Office Supplies Expense    $88.50
Dr. GST/HST ITC (Asset)        $11.50
  Cr. Bank Account            $100.00
```

**Deposit (Revenue) with 13% HST:**
```
Dr. Bank Account              $113.00
  Cr. Sales Revenue           $100.00
  Cr. GST/HST Payable          $13.00
```
