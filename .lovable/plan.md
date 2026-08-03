# Add Manitoba Hydro (MB Hydro) to eFinconnect — bill payee + remittance listing

## Context (verified from the live DB)
- The eFinconnect tax/remittance area is driven by `public.provincial_tax_authorities` (a public-read reference catalog) + `public.provincial_payee_accounts` (org-specific registered accounts), rendered by `ProvincialRemittanceCentre.tsx` (`/banking-payments/provincial`).
- Manitoba today has 3 entries: `rst_mb` (Retail Sales Tax), `eht_mb` (Health & Post-Secondary Edu Tax), `wcb_mb` (WCB). **No Manitoba Hydro.**
- The table currently has no way to tell a tax authority apart from a utility payee — all rows are treated as tax authorities. Adding Manitoba Hydro naively would label a utility as a tax.
- Bill payments (the "Pay bills" side of eFinconnect) run through the `vendors` table + bills + AP Payments (`APPayments.tsx`). Manitoba Hydro would need to exist as a vendor to be paid as a bill.

## Goal
Surface Manitoba Hydro as a Manitoba payee in eFinconnect in two ways, as you requested ("both"):
1. Listed in the **Provincial Remittance Centre** so a Manitoba org can register its Manitoba Hydro account number.
2. Payable as a **utility bill** via the AP / "Pay bills" flow (creates the bill against a Manitoba Hydro vendor).

## 1. Database — schema (migration tool)
Add a category column to distinguish tax authorities from utility payees, so Manitoba Hydro does not pollute the tax list:

```sql
ALTER TABLE public.provincial_tax_authorities
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'tax';
```
- Existing rows (RST, EHT, WCB, all provinces) default to `'tax'` automatically — no backfill needed.
- The existing public-SELECT RLS policy is unaffected.

## 2. Database — seed Manitoba Hydro (insert tool)
Insert one row so it appears under the MB group in the Remittance Centre:

```sql
INSERT INTO public.provincial_tax_authorities (code, jurisdiction, name, programs, website_url, category)
VALUES ('mb_hydro', 'MB', 'Manitoba Hydro', '["utility"]'::jsonb, 'https://www.hydro.mb.ca', 'utility')
ON CONFLICT (code) DO NOTHING;
```

## 3. Frontend — surface Manitoba Hydro

**a) `src/hooks/useProvincialAuthorities.ts`** — add `category: string` to the `ProvincialAuthority` interface so the UI can read it.

**b) `src/pages/treasury/ProvincialRemittanceCentre.tsx`** — Manitoba Hydro will auto-appear under the "MB" jurisdiction card (the page already groups by `jurisdiction`). Two small enhancements:
- Show a "Utility" badge instead of the program count for `category === 'utility'` rows, so it is visually distinct from tax authorities.
- On utility rows, add a **"Pay bill"** button that:
  - Ensures a vendor named "Manitoba Hydro" exists for the current org (creates it via the `vendors` table if missing),
  - Navigates to the Create Bill flow prefilled with that vendor (reuse the existing route/param pattern used by the purchases module).

This makes Manitoba Hydro both registerable in the remittance centre and directly payable as a bill — covering both surfaces from one entry point.

## 4. Out of scope
- No change to `countryTreasuryConfig.ts` `taxPayees` — those are tax *types* (PD7A/GST/CIT), and Manitoba Hydro is not a tax type.
- No new tax calculations or filing forms; Manitoba Hydro is a utility payee only.

## Technical details
- One schema migration (add `category` column) + one data insert (Manitoba Hydro row).
- Two small frontend file edits (the hook interface + the remittance centre).
- All existing data and policies remain valid; the new column is non-null with a safe default.

```
provincial_tax_authorities
  + category text  (tax | utility)
  * new row: mb_hydro / MB / Manitoba Hydro / [utility] / utility

ProvincialRemittanceCentre (MB group)
  └─ Manitoba Hydro  [Utility]  [Register account]  [Pay bill -> creates vendor + Create Bill]
```
