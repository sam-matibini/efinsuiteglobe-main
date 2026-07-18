## Answer to your question

**Yes — Gemini is fully capable of extracting this statement.** The 20-page RBC PDF is well within Gemini 2.5 Pro/Flash's vision limits. The failure is not a model limitation — it's an architectural limit in our edge function:

- The Lovable AI Gateway enforces a **~75s hard idle timeout** per request.
- Our current `pdf-to-spreadsheet` function sends the **entire PDF in one call**, so a 20-page statement can't finish inside 75s even on `flash-lite`.
- Copilot succeeds because it isn't bound by that per-request ceiling and internally page-chunks.

## Fix: page-chunked extraction

Rework `supabase/functions/pdf-to-spreadsheet/index.ts` so it splits large PDFs into small page batches, each fitting comfortably inside the 75s window, then merges the results.

### Changes

1. **Split PDF by page range before AI calls**
   - Use `pdf-lib` (already available via `npm:`) to slice the source PDF into batches of ~3–5 pages.
   - Base64-encode each slice and send it as its own Gemini call.

2. **Run batches sequentially with a per-call budget**
   - Keep per-call timeout at 65s (safe under the 75s gateway ceiling).
   - Use `gemini-2.5-flash` (upgrade back from `flash-lite`) since each call now processes only a handful of pages — accuracy improves without breaching the ceiling.
   - Track total elapsed time; abort remaining batches if the outer edge budget (still 220s) is close to exhausted and return partial results with a warning.

3. **Merge and reconcile across batches**
   - Concatenate `transactions[]` from each batch in page order.
   - Take `opening_balance` from the first batch, `closing_balance` from the last.
   - Recompute `totalDebits` / `totalCredits` and re-run existing reconciliation.
   - Deduplicate rows on the (date, description, amount) tuple in case a transaction spans a page break and appears in two consecutive batches.

4. **Progress + error surfacing**
   - Return `processedPages` / `totalPages` so the UI progress bar reflects real batch completion.
   - If any single batch fails, include a `validationWarnings` entry naming the page range but still return successful batches.

### Files touched

- `supabase/functions/pdf-to-spreadsheet/index.ts` — add PDF slicing, batch loop, merge logic.
- No client changes required; `usePdfToSpreadsheet.ts` already handles the same response shape.

### Out of scope

- No change to `ai-extract-bank-statement` (Alice path). That function already accepts smaller inputs; if you want the same chunking there too, say so and I'll extend it in the same pass.
- No change to the AI Sheets → Post to Banking flow.

### Verification

- Upload the attached 20-page RBC statement through the AI Sheets / PDF-to-Spreadsheet path.
- Confirm all rows extract (no 408), balances reconcile, and `payer_payee` is populated.
