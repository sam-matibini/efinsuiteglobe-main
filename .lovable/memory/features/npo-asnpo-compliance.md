# Memory: features/npo-asnpo-compliance
Updated: 2026-01-28

## ASNPO Compliance for Not-for-Profit Organizations

The system now supports ASNPO (Accounting Standards for Not-for-Profit Organizations) compliant accounting for Canadian NPOs and charities.

### Industry Types
- `npo`: Non-Profit Organizations (associations, foundations)
- `charity`: CRA-registered charities (with donation receipting)
- Both are defined in `src/types/accounting.ts` via `NPO_INDUSTRIES` array

### ASNPO-Compliant Chart of Accounts
The CoA Generator (`src/components/settings/ChartOfAccountsGenerator.tsx`) now generates ASNPO-compliant accounts for NPO/charity industries:

**Net Assets (replacing Shareholders' Equity):**
- Unrestricted Net Assets
- Internally Restricted Net Assets
- Externally Restricted Net Assets
- Endowment Net Assets
- Net Assets Invested in Capital Assets
- Excess (Deficiency) of Revenue

**Deferred Contributions (ASNPO Section 4410):**
- Deferred Grants
- Deferred Restricted Donations
- Deferred Capital Contributions

**NPO Revenue Categories:**
- Donation Revenue (Receipted/Non-Receipted)
- Grant Revenue (Government/Foundation)
- Fundraising Revenue
- Program Service Revenue
- Amortization of Deferred Contributions

**NPO Expense Categories (CRA T3010 aligned):**
- Charitable Program Expenses
- Fundraising Expenses
- Management & Administration

### Auto-Enable Donations Module
When an organization selects `npo` or `charity` industry:
- The Donations module is automatically enabled via `useNpoModuleActivation` hook
- Hook location: `src/hooks/useNpoModuleActivation.ts`
- Triggered in Settings page on organization save

### NPO Financial Terminology
`src/hooks/useLocalizedCurrency.ts` exports `NPO_FINANCIAL_TERMINOLOGY` with ASNPO-specific terms:
- Statement of Operations (not Income Statement)
- Statement of Financial Position
- Excess (Deficiency) of Revenue over Expenses (not Net Income)
- Net Assets (not Shareholders' Equity)
- Country-specific terminology for CA, US, ZM, KE, BI
