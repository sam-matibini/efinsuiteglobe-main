## Goal
Give the two Canadian tax category tabs — **CRA GST/HST** and **Provincial (PST/QST)** — distinct color identities so users can visually distinguish federal vs provincial reporting at a glance.

## Color scheme
- **CRA GST/HST** → emerald/green (federal, matches the highlight in the reference image)
- **Provincial (PST/QST)** → sky blue (matches the reference image)

Colors applied only to the **active** state (background tint + colored text + subtle bottom accent). Inactive state keeps a muted foreground with a small color dot so the identity is still hinted at.

## Files to update
1. `src/components/tax/TaxReportPreview.tsx` (lines ~695–706) — the Tax Reports header tabs shown in the screenshot.
2. `src/pages/SalesTax.tsx` (lines ~565–576) — the Tax Summary tab uses the same two-tab pattern; color it identically for consistency.

## Implementation
For each `TabsTrigger`, add conditional classes using semantic-friendly Tailwind utilities:

- GST trigger:
  `data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-700 dark:data-[state=active]:text-emerald-400 data-[state=active]:shadow-sm data-[state=active]:border-b-2 data-[state=active]:border-emerald-500`
- PST trigger:
  `data-[state=active]:bg-sky-500/10 data-[state=active]:text-sky-700 dark:data-[state=active]:text-sky-400 data-[state=active]:shadow-sm data-[state=active]:border-b-2 data-[state=active]:border-sky-500`

The `FileText` icon inherits the active text color automatically. No changes to logic, state, or business rules.

## Out of scope
- Report body styling, headers, filters, PDF output.
- Any other tabs (Reports/Summary top-level tabs remain unchanged).