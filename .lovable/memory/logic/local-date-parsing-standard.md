# Memory: logic/local-date-parsing-standard
Updated: 2026-02-09

The `parseLocalDate` utility in `src/lib/utils.ts` is the **centralized solution** for preventing timezone-related 'off-by-one' errors across the entire application. It treats YYYY-MM-DD date strings as local midnight rather than UTC, ensuring dates displayed in the UI exactly match stored database values regardless of the user's browser timezone.

## Implementation

```typescript
// src/lib/utils.ts
export function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/)?.slice(1).map(Number) || [];
  return new Date(year, month - 1, day);
}
```

## Where Applied

The utility is now used consistently in:
- **`useLocalizedCurrency.ts`** - `formatDate()` hook method
- **`localizedCurrencyFormatter.ts`** - `formatDate()` utility function
- **Page components**: `JournalEntries.tsx`, `Bills.tsx`, `Invoices.tsx`, `Reconciliation.tsx`, `CreditCardReconciliation.tsx`
- **PDF generators**: `generatePayStubPdf.ts`, `generateRoePdf.ts`
- **Payroll modules**: `TimesheetDetail.tsx`, `EmployeeTimesheets.tsx`, `PayRuns.tsx`, `ViewPayRunDialog.tsx`
- **Reports**: `TrialBalance.tsx`

## Usage Guidelines

1. **Always use `parseLocalDate()`** when converting date strings to Date objects for display
2. **Use `formatLocalDateString()`** when converting Date objects to YYYY-MM-DD for storage
3. **Never use `new Date(dateStr)`** directly for YYYY-MM-DD strings - this interprets as UTC midnight and causes day-shift errors in western timezones
