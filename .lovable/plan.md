## Plan: 20-page PDF statement extraction

### Goal
Make Alice AI Sheets handle a 20-page bank/credit-card statement in one user session without timing out, while preserving the existing bank/credit-card mapping accuracy.

### Current confirmed limits
- The extractor currently slices PDFs into 5-page batches.
- It processes those batches sequentially.
- It has a 65s timeout per AI batch and a 220s total edge-function budget.
- For 20 pages, that means 4 sequential AI calls, which can exceed the total budget and fail before all pages are processed.

### Implementation steps
1. **Reduce batch size for reliability**
   - Change statement extraction to use smaller 2-page or 3-page batches so each Gemini request has less work and is less likely to hit the gateway idle timeout.

2. **Run statement batches in limited parallel groups**
   - Process multiple page batches concurrently, with a safe concurrency limit.
   - Keep results ordered by page range before merging, so transactions remain in statement order.

3. **Keep timeout protection**
   - Keep a per-request timeout under the gateway ceiling.
   - Keep a global edge budget guard so the function returns a controlled error or partial warning instead of hanging.

4. **Improve 20-page user feedback**
   - Return `totalPages`, `processedPages`, and warnings when any page range fails.
   - Update AI Sheets toast/error messaging so the user sees whether all 20 pages were processed or which page ranges failed.

5. **Preserve credit-card mapping rules**
   - Keep the existing Charge/Payment output for credit-card statements.
   - Preserve payment keyword correction so rows like `PAYMENT - THANK YOU` map to Payment/Credit, not Charge/Debit.

### Technical details
- Main file: `supabase/functions/pdf-to-spreadsheet/index.ts`
- Frontend feedback: `src/hooks/usePdfToSpreadsheet.ts` and AI Sheets upload handling in `src/components/dashboard/AISheets.tsx`
- No database schema changes are required.
- No new secrets are required because the function already uses the configured Lovable AI Gateway key.

### Expected result
A 20-page statement should be processed as multiple smaller Gemini calls in parallel, reducing total wall-clock time enough to complete within the edge-function budget and return a complete AI Sheets workbook.