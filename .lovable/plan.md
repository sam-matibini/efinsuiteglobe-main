## Problem

On the Nigerian pay slip PDF (`src/lib/generatePayStubPdf.ts`), the header renders two issues visible in the screenshot:

1. The company name is drawn **twice** — once as the large left-aligned title and again as a right-aligned label above the address block. Because the right-aligned copy is not wrapped to a max width, it overflows leftward and collides with the big left title ("Earthweb Security and Intelligence Network Limited" overlaps itself).
2. The organization logo is not rendered at all — the current header only draws text, so the "logo" area is effectively missing.

## Fix (scope: `src/lib/generatePayStubPdf.ts` header block only, lines ~121-158)

1. **Load and draw the logo** on the left using the same base64 loader pattern already used in `src/lib/pdfBrandingFooter.ts` (`loadLogoAsBase64`) but sourced from `getDocumentLogoUrl(organization, 'payroll')` when available; fall back to no logo if none is configured. Make `generatePayStubPdf` accept an optional `logoDataUrl` (pre-loaded by the caller) so the function stays synchronous, and add an async wrapper `generatePayStubPdfAsync` for callers that want auto-loading. Update `PaystubViewer` and `ViewPayRunDialog` (the two current callers) to preload the logo and pass it in.
2. **Rework the header layout** to eliminate the overlap:
   - Left column: logo (max 22mm wide × 16mm tall, preserving aspect ratio) followed by the company name in 14pt bold, wrapped with `doc.splitTextToSize` to `pageWidth/2 - leftMargin - 4mm`.
   - Right column: employer mailing address only (no duplicate company name), right-aligned, each line wrapped to `pageWidth/2 - rightMargin padding`.
   - Compute `y` after the header as `max(leftBlockBottom, rightBlockBottom) + 6mm` before drawing the "EMPLOYEE PAY SLIP" subtitle and divider, so long company names or long addresses can never collide.
3. Keep all downstream sections (Employee/Pay Period, Earnings, Deductions, Net Pay, YTD, footer) unchanged.

## Technical notes

- No DB changes, no new dependencies.
- Currency/localization work from the previous turn is untouched.
- `getDocumentLogoUrl` already handles `payroll_show_logo` + `payroll_logo_url` fallback to `logo_url`, so logo visibility respects existing org settings.
- Logo aspect ratio: read natural dimensions via an `Image()` in the async loader and scale to fit the 22×16mm box.

## Files touched

- `src/lib/generatePayStubPdf.ts` — header rewrite + optional `logoDataUrl` param + async wrapper.
- `src/components/payroll/PaystubViewer.tsx` — preload logo, pass to generator.
- `src/components/payroll/ViewPayRunDialog.tsx` — same.
