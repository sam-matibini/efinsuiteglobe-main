## Goal
Add a **Payer/Payee** field (AI-extracted from transaction description) to all three extraction outputs:
1. AI Sheets PDF-to-Spreadsheet output
2. Bank statement extraction engine
3. Credit card statement extraction engine

## Changes

### 1. `supabase/functions/_shared/gemini.ts` — no change
Prompts and schemas driven per-function.

### 2. `supabase/functions/ai-extract-bank-statement/index.ts`
- Add `payer_payee: { type: "string" }` to the transaction schema in `SCHEMA`.
- Update `SYSTEM_PROMPT` with a rule: *"Extract the counterparty (payer for credits/deposits, payee for debits/charges) from the description. Strip trailing reference numbers, city/state, transaction IDs, and card suffixes. Use the cleaned merchant/person/institution name. Leave empty only if truly unidentifiable (e.g., 'INTEREST', 'BANK FEE')."*

### 3. `supabase/functions/pdf-to-spreadsheet/index.ts`
- Add a `Payer/Payee` column to the AI Sheets workbook output. Instruct Gemini in the prompt to populate it using the same cleaning rules. Column placed after `Description` (before `Amount`/`Type`).
- Ensure the generated XLSX header row and data rows include the new column.

### 4. Client type + hook: `src/hooks/useBankStatementExtraction.ts`
- Add `payer_payee?: string` to `ExtractedTransaction`.

### 5. `src/components/banking/StatementExtractionDialog.tsx`
- Display new `Payer/Payee` column in the preview table.
- Include it in the CSV/mapping payload passed forward.

### 6. `src/components/banking/MappingPreviewDialog.tsx`
- Recognize `Payer/Payee` (case-insensitive, also match `payee`, `payer`, `counterparty`, `merchant`) as an auto-mapped column and pass value to downstream import (populates existing `payee` field on bank/CC transactions).

### 7. `src/hooks/useAliceSheetsWorkbooks.ts` / AI Sheets import path
- When AI Sheets workbook is used as feed to Statement Extraction Engine, auto-detect the `Payer/Payee` column header and map it to the same downstream field.

## Out of scope
- No DB schema changes (bank/CC transaction tables already have a `payee`/description field to receive it).
- No GL posting logic changes.
- No historical backfill.

## Files touched
- `supabase/functions/ai-extract-bank-statement/index.ts`
- `supabase/functions/pdf-to-spreadsheet/index.ts`
- `src/hooks/useBankStatementExtraction.ts`
- `src/components/banking/StatementExtractionDialog.tsx`
- `src/components/banking/MappingPreviewDialog.tsx`
