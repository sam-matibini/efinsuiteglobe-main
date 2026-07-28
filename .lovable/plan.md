## Issues

1. **"This page has been blocked by Chrome"** appears when clicking **Print** on a pay stub. `PaystubViewer.handlePrint` opens a blank popup and writes an HTML document containing an `<iframe src="data:application/pdf;base64,...">`. Chrome now blocks navigations to `data:` URLs (and about:blank documents that host them), producing the blocked-page screen shown.
2. **Console warning**: `Function components cannot be given refs … Check the render method of PaystubViewer` — originates from the `<DropdownMenu>` block inside `PaystubViewer`. The Radix trigger tries to attach a ref, and something in the trigger chain is not a `forwardRef`. Low-severity, but easy to eliminate at the same time.

## Fix

### 1. `src/components/payroll/PaystubViewer.tsx` — `handlePrint`
Replace the `data:` URI + `document.write` popup with a Blob URL flow that Chrome allows:

- `const blob = doc.output('blob');`
- `const url = URL.createObjectURL(blob);`
- `const w = window.open(url, '_blank');` (browser's native PDF viewer handles Print)
- If popup blocked → toast + fall back to `doc.autoPrint(); doc.save(...)`.
- `URL.revokeObjectURL(url)` after a short delay / on window close.

This removes the `document.write` + `data:` URI pattern that Chrome flags.

### 2. `src/components/payroll/PaystubViewer.tsx` — DropdownMenu ref warning
Wrap the `View & Share` trigger's `<Button>` inside a `<span>` (or ensure the `Button` is the sole `asChild` child — it already is, so the more reliable fix is to drop `asChild` and pass the icon/label as `DropdownMenuTrigger` children directly styled like a button). This silences the ref warning without changing behavior.

## Out of scope

No other files or behaviors change. Purely the two presentation fixes above.