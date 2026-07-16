## Phase 9 — Statement Extraction: Payment classification fix + AI Sheets feed

Two problems observed on the RBC Avion Visa upload (screenshot):

1. Statements with a **single signed AMOUNT column** (RBC Avion, Amex, many CC statements) confuse the extractor. Because the tool schema forces a positive `debit`/`credit` split and the model has no separate credit column to read from, `-$1,000.00 PAYMENT - THANK YOU` gets stuffed into `debit` → downstream renamed to `Charge` → imported as a charge. The Alice import path also classifies CC rows by amount sign (`rawAmount >= 0 ? 'charge' : 'payment'`), bypassing the project's description-first rule (see `credit-card-import-sign-convention` memory).
2. There is no way to feed rows already cleaned in Alice AI Sheets back into the Statement Extraction Engine as an alternative to re-uploading the PDF.

### Fix 1 — Correct payment/charge classification end-to-end

**Edge function `pdf-to-spreadsheet/index.ts`**
- Extend `STATEMENT_TOOL` with an optional `signedAmount` field and a `direction: "payment" | "charge" | "debit" | "credit"` hint per row.
- Update `STATEMENT_PROMPT` with an explicit branch: "If the statement has a single AMOUNT column with signs (e.g. RBC Avion), read the sign — negative = payment/credit, positive = charge/debit — AND read the description ('PAYMENT', 'PAIEMENT', 'THANK YOU', 'AUTOPAY' → payment/credit). Do NOT force everything into `debit`."
- Post-processing in `tryStatement`: when only one side is populated and the description matches a payment/refund keyword list (payment, paiement, thank you, autopay, refund, credit memo, reversal, chargeback), move the value from `debit` → `credit`. Log a `validationWarnings` note.
- When rows are relabelled to Charge/Payment for the CC sheet, run the same keyword scan and move Charge→Payment when the description is clearly a payment. Reconciliation totals recomputed after the swap.

**Alice import handler `AIAccountingAssistant.tsx::handleExtractionComplete` (CC branch, line 315-340)**
- Replace `transactionType = rawAmount >= 0 ? 'charge' : 'payment'` with a call to `classifyCreditCardType` from `src/lib/creditCardImportNormalizer.ts`, passing description, explicit type column (if the row already carries `transaction_type`), and signed amount as fallback. This aligns Alice's path with the standard CC import normalizer per the existing memory.
- Same call is used for rows fed from AI Sheets (Fix 2).

### Fix 2 — Load AI Sheets rows as an alternative feed

`StatementExtractionDialog.tsx` currently accepts file uploads only. Add a second entry point:

- New "Load from AI Sheets" section on the upload step, alongside the file dropzone.
- A dropdown listing recent AI Sheets workbooks for the current organization. Source: list objects in the existing `docsign-documents` storage bucket under `ai-sheets/` (already written by `pdf-to-spreadsheet`), sorted by upload time, showing filename + date.
- Selecting a workbook fetches the `.xlsx` via signed URL, parses it with the already-imported `xlsx` library, populates `extractedData` and `extractedColumns`, and jumps straight to the `mapping` step (skipping extraction). A `_sourceFile` marker is added so the downstream import audit trail shows "AI Sheets: <name>".
- Toggle chip at the top of the dialog: **File upload** | **AI Sheets** — visual separation, single state machine underneath.
- Small badge on imported rows indicating the source ("PDF" vs "AI Sheets") for review.

Optional (nice-to-have, kept in scope): remember the last-used AI Sheets workbook per statement type in localStorage so the user doesn't hunt for it each time.

### Files

**Edited**
- `supabase/functions/pdf-to-spreadsheet/index.ts` — prompt + tool schema + post-swap logic
- `src/components/dashboard/AIAccountingAssistant.tsx` — use `classifyCreditCardType` in CC import
- `src/components/banking/StatementExtractionDialog.tsx` — add AI Sheets source picker + xlsx fetch-and-parse
- `src/lib/creditCardImportNormalizer.ts` — no logic change, just export used by the new call site (already exported per memory)

**Created**
- `src/hooks/useAliceSheetsWorkbooks.ts` — lists `ai-sheets/*.xlsx` from `docsign-documents` bucket, returns `{ path, name, uploaded_at, size, signed_url }`.

### Out of scope
- Structural changes to the CC transactions schema or GL posting logic.
- Reprocessing historical mis-classified transactions (users can fix via the existing edit flow; a bulk fixer would be a separate phase if requested).
- Multi-card sub-account splitting on RBC Avion (each cardholder ending in 4977/4969) — the current single-credit-card target will be kept; noted for a future phase.
