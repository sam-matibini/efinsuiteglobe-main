
# eFinconnect — Nigeria Localization + Country Customization Switch

Extend the eFinconnect (Treasury) module so its payment rails, tax remittance flows, and dashboard actions adapt to the organization's country. Nigeria is the first non-CA/US target; the same switch lets us plug in future countries without touching UI code.

## Goals

1. Nigerian orgs see NG-appropriate payment rails, tax payees, and remittance workflows in eFinconnect.
2. A single country-driven configuration ("localization switch") controls which rails, tax authorities, and dashboard cards are shown — replacing today's CA/US-only assumptions in `TreasuryDashboard`, tax payment flows, and funding accounts.
3. Nigeria WHT/VAT/CIT/PAYE remittances flow through the existing NG Tax Engine (`ng_tax_transaction_ledger` → `ng_tax_remittances`) but are now paid via eFinconnect batches with proper JE posting.

## Scope

### 1. Country rail registry (new)
- New file `src/config/countryTreasuryConfig.ts` exporting a typed registry keyed by ISO country code. Each entry defines:
  - Available payment rails (`ach`, `eft`, `interac`, `wire`, `nibss_instant`, `nibss_neft`, `rtgs`, `sepa`, `faster_payments`, `pix`, etc.)
  - Tax authorities/payees shown in "Pay business taxes" (CA: CRA/provincial; US: IRS/state; NG: FIRS/SIRS/PENCOM/NHF/NSITF/ITF)
  - Dashboard action visibility (e.g. hide Interac for non-CA, show "Pay salaries via NIBSS" for NG)
  - Default currency + settlement cutoffs / delivery-estimate chip text
- `useCountryTreasuryConfig()` hook reads the current organization's `country_code` and returns the merged config (with a `default` fallback so unknown countries still work).

### 2. Nigeria rail + payee seed data
- Migration `seed_nigeria_treasury_config`:
  - Insert NG rows into `cra_payee_catalog`-equivalent — reuse existing `provincial_payee_accounts` pattern by creating (if missing) a generic `tax_payee_catalog` view OR extend `provincial_payee_accounts` with a `country_code` column defaulting to `'CA'`. Chosen approach: **add `country_code` to `provincial_payee_accounts`** and seed NG payees (FIRS-VAT, FIRS-WHT, FIRS-CIT, FIRS-PAYE-FCT, LIRS-PAYE, PENCOM, NHF, NSITF, ITF). Include GRANTs unchanged.
  - Seed default NG payment rails into a new `treasury_country_rails` table (org-agnostic reference) OR keep purely in the TypeScript registry above. **Decision: keep in TS registry** — no need for DB round-trips for static rail metadata; only *organization-specific* rail enablement lives in DB (`bank_accounts.isPaysafeEftEnabled` style flags).
- New nullable columns on `bank_accounts`: `is_nibss_enabled boolean default false`, `is_rtgs_enabled boolean default false` (Nigeria equivalents of the existing Stripe ACH/Paysafe EFT flags). Include GRANT-preserving migration.

### 3. eFinconnect Dashboard — country-driven cards
- Refactor `src/pages/treasury/TreasuryDashboard.tsx`:
  - Replace hard-coded Bills/Transfers arrays with `useCountryTreasuryConfig()` output.
  - For NG orgs, show:
    - **Bills**: Pay bills, Pay FIRS taxes, Pay state (SIRS) taxes, Pay pension/NHF, Pay salaries (NIBSS)
    - **Transfers**: Between accounts, NIBSS Instant (NIP), NEFT, RTGS, Cash pickup
    - **Payments & Collections**: Payment links, Paystack/Flutterwave (future), Scheduled
  - Delivery chips localized ("Instant" for NIP, "Same day" for RTGS, "T+1" for NEFT).
  - CA/US behavior unchanged — the CA config reproduces the current Scotiabank-style layout exactly.

### 4. Tax payment flow
- `src/pages/treasury/CRAPayments.tsx` (current route the user is on) is CA-specific. Introduce a router-level split:
  - Keep `/banking-payments/cra-payments` for CA.
  - New `/banking-payments/tax-payments` generic page that renders the correct payee list based on `country_code`. NG orgs land here from the dashboard "Pay FIRS taxes" and "Pay state taxes" cards.
  - Under the hood, reuse the existing `tax_payments` table and `treasury-pay-tax` edge function — just filter payee options and JE mapping (liability GL account) by country.
- Wire NG remittances so that clicking "Pay" on an `ng_tax_remittances` row with status `ready` creates a `tax_payments` row, routes through `treasury-pay-tax`, and on success updates `ng_tax_remittances.status = 'remitted'` + stamps `paid_at` (extend the existing `ng_post_remittance` RPC or add a new `ng_mark_remittance_paid` RPC).

### 5. Settings — customization switch
- Extend `TreasurySettings.tsx`:
  - Add a **Country & Rails** card at the top showing the org's country (read-only, sourced from `organizations.country_code`) and a table of rails available for that country. Each row: rail name, description, per-bank-account enable toggles.
  - The existing "Stripe ACH" / "Paysafe EFT" columns become conditional; NG orgs see "NIBSS Instant" / "RTGS" toggles driven by the new bank-account flags.
- No new global country selector — country is already set on the organization and drives everything.

### 6. Backend function updates
- `supabase/functions/treasury-pay-tax`: accept an optional `country_code` (fallback: read from `organizations`), pick the correct liability GL account mapping and rail based on the registry, and post the JE against the right authority payee row.
- No new secrets required; NIBSS/RTGS execution stays stubbed behind the same `enable*` mutations used today for Stripe/Paysafe (real bank API wiring is out of scope for this phase).

## Out of scope (deferred)

- Live NIBSS/Paystack/Flutterwave API integration — this phase adds structure + JE posting only; actual outbound execution remains a stub with `status='processing'` like the current Paysafe path.
- Other countries (GB, EU, IN) — registry supports them, but only NG data is seeded now.
- Mobile treasury shell updates.

## Technical notes

- All new DB objects follow the public-schema GRANT rules (SELECT/INSERT/UPDATE/DELETE to `authenticated`, ALL to `service_role`) and are RLS-scoped by `organization_id`.
- No CHECK constraints on time-based fields; use triggers if needed.
- TypeScript registry lives outside the DB so it can evolve without migrations; only per-org enablement flags are persisted.
- Existing CA flow (`CRAPayments`, Scotiabank-style dashboard, Stripe ACH toggles) is preserved bit-for-bit via the CA registry entry.

## File touch list

- New: `src/config/countryTreasuryConfig.ts`, `src/hooks/useCountryTreasuryConfig.ts`, `src/pages/treasury/TaxPayments.tsx`
- Modified: `src/pages/treasury/TreasuryDashboard.tsx`, `src/pages/treasury/TreasurySettings.tsx`, `src/App.tsx` (route), `supabase/functions/treasury-pay-tax/index.ts`, `src/hooks/useFundingBankAccounts.ts` (add NIBSS/RTGS mutations)
- Migrations: add `country_code` + NG seeds to `provincial_payee_accounts`; add `is_nibss_enabled`/`is_rtgs_enabled` to `bank_accounts`; add `ng_mark_remittance_paid` RPC.
