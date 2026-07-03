# Memory: features/banking/multi-account-coa-templates
Updated: now

The Chart of Accounts (CoA) generator and banking module now support multiple bank and credit card accounts by default:

## Bank Account Structure (Asset - 1-01-101-XXXX)
- **1-01-101-0001**: Operating Bank Account (primary checking for day-to-day transactions)
- **1-01-101-0002**: Payroll Bank Account (dedicated for payroll disbursements)
- **1-01-101-0003**: Savings/Reserve Account (for contingency funds)
- **1-01-101-0004**: Foreign Currency Account (USD for CAD orgs, EUR for GBP orgs, etc.)
- **1-01-102-0001**: Petty Cash (cash on hand for small expenses)

## Credit Card Liability Structure (Liability - 2-01-110-XXXX)
- **2-01-110-0001**: Corporate Credit Card (main business card)
- **2-01-110-0002**: Employee Expense Card (for reimbursable expenses)
- **2-01-110-0003**: Travel & Entertainment Card (or Fleet/Fuel Card for relevant industries)

## Key Files
- **`src/data/defaultBankingAccounts.ts`**: Default bank and credit card GL account templates by currency
- **`src/data/localizedBankingInstitutions.ts`**: Banking institutions and credit card issuers by country (CA, US, ZM, KE, BI)
- **`supabase/functions/ai-coa-generator/index.ts`**: Enhanced prompt to generate multiple banking accounts

## Currency-Specific Templates
Default bank accounts are localized by currency (CAD, USD, EUR, GBP) in `src/data/defaultBankingAccounts.ts`.

## Industry-Specific Extensions
Fleet industries (automotive, construction, transportation, logistics, trucking, delivery, utilities) automatically get Fleet/Fuel Card accounts instead of generic Travel cards.

## Credit Card Issuers
The `src/data/localizedBankingInstitutions.ts` file includes credit card issuer lists by country with network type (Visa, Mastercard, Amex, etc.) and issuer type (bank, independent, retail, fleet).

## Component Updates
- **`AddCreditCardDialog.tsx`**: Uses localized credit card issuers via `getCreditCardIssuersForCountry()`
- **`EditCreditCardDialog.tsx`**: Uses localized credit card issuers via `getCreditCardIssuersForCountry()`
- **`EditBankAccountDialog.tsx`**: Uses localized banking institutions via `getInstitutionsForCountry()`

## GL Account Matching
All banking dialogs now match the new hierarchical code structure:
- Bank accounts: `1-01-101-XXXX` or `1-01-102-XXXX` (in addition to legacy `100`, `101`, `102` prefixes)
- Credit card accounts: `2-01-110-XXXX` (in addition to legacy `200`, `201`, `210` prefixes)
