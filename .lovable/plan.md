# Nigeria: Rate Updates + IFRS + CoA

Confirmed via DB: `countries.accounting_standard` for `NG` is already `IFRS`. A `Nigeria SMEs (IFRS)` CoA template exists with 62 accounts. The AI Rate Updates UI (`AutoRateUpdatesTab.tsx`) currently supports CA, US, ZM, KE, BI — Nigeria is missing from the picker, historicals, prompt, and fallback rates.

## 1. AI-Powered Tax Authority Rate Updates — add Nigeria (FIRS)

**`src/components/settings/AutoRateUpdatesTab.tsx`**
- Add `NG: { name: 'Nigeria', flag: '🇳🇬', currency: 'NGN', authority: 'FIRS' }` to `COUNTRY_LABELS`.
- Add `HISTORICAL_RATES.NG` for 2024 and 2025 covering: VAT 7.5%, PAYE progressive brackets (7/11/15/19/21/24%), Pension (8% ee / 10% er), NHF (2.5%), ITF (1%), NSITF (1%), CIT tiers (small 0%, medium 20%, large 30%), TET 3%, WHT common rates.
- Add Nigeria bullet to the "Supported Countries" legend.

**`supabase/functions/ai-rate-update/index.ts`**
- Add `NG` entry to `systemPrompts` describing FIRS + State IRS (PAYE), Finance Act, PenCom, NHF, ITF, NSITF, TET, CIT authority scope.
- Extend `getFallbackRates` with an `NG` branch producing:
  - `sales_tax_changes`: VAT 7.5%, VAT-Zero, VAT-Exempt, WHT rates (contracts 5%, professional services 10%, rent 10%, dividends 10%, directors' fees 10%).
  - `payroll_changes`: Pension, NHF, ITF, NSITF (with employee/employer split and ceilings).
  - `tax_brackets`: Finance Act 2023 PAYE bands.
  - `tax_credits`: Consolidated Relief Allowance (CRA — 20% + higher of ₦200,000 or 1% of gross).
  - `authority_sources`: FIRS, PenCom, NHF, ITF, NSITF, relevant State IRS, Finance Act 2023.
- Confidence 0.85; notes cite Finance Act 2023 and PIT Act.

## 2. IFRS for Nigeria (accounting standard)

Already `IFRS` at country level. Enhancements:
- Update the "Nigeria SMEs (IFRS)" CoA template to explicitly stamp `accounting_framework = 'IFRS'` on the template row (if the column exists) so downstream org creation inherits it. Verify at implementation time; skip if column absent.
- No app code changes required beyond confirming `CreateOrganizationDialog` reads `countries.accounting_standard` for the default (spot-check during build).

## 3. Update Chart of Accounts (Nigeria IFRS template)

Migration to refresh `coa_templates` + `coa_template_accounts` for the Nigeria template so it's IFRS-aligned and current with the tax engine:
- Ensure presence of tax-liability accounts referenced by the NG tax engine: VAT Output Payable, VAT Input Recoverable, WHT Payable (Companies), WHT Payable (Individuals), PAYE Payable, Pension Payable, NHF Payable, ITF Payable, NSITF Payable, CIT Payable, TET Payable, Stamp Duty Payable, CGT Payable.
- Add IFRS-specific presentation accounts if missing: Right-of-Use Assets, Lease Liabilities (current/non-current), Deferred Tax Asset, Deferred Tax Liability, Retained Earnings, Other Comprehensive Income (FVOCI reserve), Revaluation Surplus.
- Idempotent inserts via `ON CONFLICT (template_id, code) DO NOTHING`.

## Technical notes

- Framework value used across app is `IFRS` (matches existing `Organization.default_accounting_framework`).
- Rate fallbacks return same shape as other countries so the UI table renders without code branches.
- No RLS/policy changes; `coa_templates` is global reference data owned by service role.
