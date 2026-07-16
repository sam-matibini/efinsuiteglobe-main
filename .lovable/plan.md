## Plan

Fix the Accountant Dashboard compilation report generator so the export Balance Sheet mirrors the on-screen Balance Sheet logic shown in your attachments.

### Problem to fix

The compilation PDF currently includes **Dividends Paid** inside the Equity section and subtracts it again from Total Equity:

```text
Common Shares                100
Dividends Paid           194,000   <-- should not be displayed here
Retained Earnings        154,520
Total Equity             (39,380)
Total Liabilities + Equity 119,710
```

But the on-screen Balance Sheet correctly excludes dividends from Equity because dividends are already netted inside the Statement of Retained Earnings closing balance:

```text
Common Shares                100
Retained Earnings        154,520
Total Equity             154,620
Total Liabilities + Equity 313,710 = Total Assets
```

### Changes

1. **Update the shared compilation equity classifier** in `generateCompilationPdfEnhanced.ts`
   - Extend the existing RE/CYE exclusion logic to also exclude dividend / distribution / owner drawing / debit-normal contra-equity accounts from the compilation Balance Sheet equity section.
   - Match the logic already used by `BalanceSheet.tsx`:
     - exclude Retained Earnings accounts
     - exclude Current Year Earnings accounts
     - exclude Dividends Paid / distributions / drawings / treasury stock / debit-normal equity accounts

2. **Fix PDF export totals and display**
   - The PDF Balance Sheet will no longer render “Dividends Paid” as a standalone equity line.
   - Total Equity will be calculated as:

```text
other equity accounts excluding RE/CYE/dividend-contra-equity
+ Statement of Retained Earnings closing balance
```

3. **Fix Excel export totals and display**
   - Apply the same exclusion in `generateCompilationExcel.ts` so the Balance Sheet worksheet matches the PDF and on-screen report.

4. **Fix Word export totals and display**
   - Apply the same exclusion in `generateCompilationWord.ts` so Word output does not duplicate dividends in Equity.

5. **Keep retained earnings source unchanged**
   - Continue using the `calculate_retained_earnings_statement` RPC closing balance already passed from `AccountantDashboard.tsx`.
   - No changes to the retained earnings RPC or on-screen Balance Sheet logic.

6. **Verification**
   - Confirm the compilation Balance Sheet no longer shows “Dividends Paid” in Equity.
   - Confirm exported Total Liabilities and Equity equals Total Assets for the current and comparative periods, within rounding tolerance.
   - Confirm Retained Earnings in the export matches the Statement of Retained Earnings closing balance.