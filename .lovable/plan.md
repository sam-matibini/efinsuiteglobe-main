## Change

Nigeria's tax authority has been renamed from **Federal Inland Revenue Service (FIRS)** to **Nigeria Revenue Service (NRS)**. Update all user-facing labels and DB display rows.

## Approach

Keep the short code as **NRS** and full name as **Nigeria Revenue Service**. Stable internal IDs like `FIRS-VAT` in `countryTreasuryConfig.ts` and the `authority` field values will be renamed to `NRS-*` / `NRS` since these are only used within the app (not linked to external persisted keys).

## Files to update

### 1. `src/config/countryTreasuryConfig.ts` (NG section)
- Comment on line 44: `'FIRS'` → `'NRS'`
- Comment on line 42: `'FIRS-VAT'` → `'NRS-VAT'`
- taxPayees codes `FIRS-VAT/WHT/CIT/PAYE-FCT` → `NRS-VAT/WHT/CIT/PAYE-FCT`
- taxPayees `authority: 'FIRS'` → `authority: 'NRS'` (4 entries)
- Labels: `'FIRS — …'` → `'NRS — …'`
- Bills tile: `'Pay FIRS taxes'` → `'Pay NRS taxes'`, description `"Federal Inland Revenue Service"` → `"Nigeria Revenue Service"`, URL `authority=FIRS` → `authority=NRS`

### 2. `src/pages/tax/NigeriaTaxEngine.tsx`
- Line 1072: input placeholder `"FIRS receipt no."` → `"NRS receipt no."`
- Line 1215: description mentions `FIRS TaxProMax` → `NRS TaxProMax` (portal branding assumed to follow)

### 3. `src/components/settings/AutoRateUpdatesTab.tsx`
- Line 318: `authority: 'FIRS'` → `authority: 'NRS'`
- Line 977: `FIRS - VAT, WHT, …` → `NRS - VAT, WHT, …`
- Source strings on lines 261-289, 310: `'FIRS VAT Act…'` → `'NRS VAT Act…'`, `'FIRS WHT Regulations'` → `'NRS WHT Regulations'`, `'FIRS / Finance Act 2023'` → `'NRS / Finance Act 2023'`

### 4. `supabase/functions/ai-rate-update/index.ts`
- Update Nigeria system prompt (line 206) and prompt sections (515, 516, 589, 1016) to say **Nigeria Revenue Service (NRS)** instead of FIRS / Federal Inland Revenue Service.
- Source strings on lines 1019-1026: `'FIRS …'` → `'NRS …'`
- Line 1053: `'FIRS - Federal Inland Revenue Service (firs.gov.ng)'` → `'NRS - Nigeria Revenue Service (nrs.gov.ng)'`
- Line 1064 notes: swap `FIRS` → `NRS`, `firs.gov.ng` → `nrs.gov.ng`

### 5. `src/config/countryModuleMap.ts`
- Line 14 comment: `FIRS / SIRS / PAYE` → `NRS / SIRS / PAYE`

### 6. `src/lib/ngTax/submission.ts`
- Line 8 comment: `FIRS TaxProMax` → `NRS TaxProMax`

### 7. New DB migration — rename existing authority text
- Update `public.tax_types.description` where description contains "FIRS": `'FIRS VAT 7.5%'` → `'NRS VAT 7.5%'`, `'FIRS/SIRS WHT'` → `'NRS/SIRS WHT'` (jurisdiction remains 'federal').
- If a `public.tax_authorities` row exists for Nigeria with `name` containing "Federal Inland Revenue Service" or code `FIRS`, update `name` to `'Nigeria Revenue Service'` and `code`/`short_name` (if present) to `'NRS'`. Use `WHERE country_id = (SELECT id FROM countries WHERE code = 'NG')`.

## Out of scope
- No changes to comments containing the word "FIRST" (unrelated to FIRS).
- `RevenueChart.tsx`, `ExpensesPieChart.tsx`, `AccountsSnapshot.tsx`, `AIFinancialToolkit.tsx`, `useFixedAssets.ts`, `SearchableOrgSwitcher.tsx` only contain the word "FIRST" — untouched.

## Verification
- eFinconnect Bills tile reads **"Pay NRS taxes — … Nigeria Revenue Service."**
- Settings → Rate Updates shows Nigeria authority as **NRS**.
- Nigeria Tax Engine placeholders and helper text reference **NRS**.