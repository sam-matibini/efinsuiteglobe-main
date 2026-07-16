# Phase 2 — PDF Bank Statement Extraction (Gemini Vision)

Builds on the Phase 1 Gemini foundation. Adds AI-powered extraction of bank/credit-card statements from PDFs and images, feeding directly into the existing bank import pipeline.

## What gets built

### 1. Edge function: `ai-extract-bank-statement`
- Accepts: `{ documentId }` OR `{ fileBase64, mimeType, filename }`
- Loads PDF/image, sends to Gemini 2.5 Pro (vision) with a strict JSON schema
- Returns structured extraction:
  ```
  {
    account: { bank_name, account_number_masked, currency, statement_period_start, statement_period_end },
    opening_balance, closing_balance,
    transactions: [{ date, description, amount, type: 'debit'|'credit', balance?, reference? }],
    confidence: 0-1,
    warnings: []
  }
  ```
- JSON-mode via `responseSchema` (reuses `_shared/gemini.ts`)
- Handles multi-page PDFs by passing full document to Gemini (native PDF support)
- Caches raw extraction on the `documents` row (new `ai_extraction` jsonb column) so re-review doesn't re-bill
- Per-org daily cap (default 100 extractions/day), logged to `ai_setup_logs`

### 2. Migration
- Add `ai_extraction jsonb`, `ai_extraction_confidence numeric`, `ai_extracted_at timestamptz` columns to `documents`
- No new tables

### 3. Client: `BankStatementExtractor` component
- New route/tab under existing Bank module: **Import → Extract from PDF**
- Upload zone (PDF/PNG/JPG, ≤20MB)
- Calls edge function, shows progress + confidence badge
- Editable review table (all transactions, inline edits, checkbox to include/exclude)
- Account matcher: dropdown of user's `bank_accounts` with fuzzy match on extracted account number
- "Import N transactions" → inserts into `bank_transactions` with `source='ai_extracted'`, links to the document

### 4. Integration points
- Reuses existing `documents` storage bucket + upload flow
- Feeds into existing `bank_transactions` table (no schema change to it)
- Existing transaction rules & reconciliation flow apply automatically after import

## Out of scope (later phases)
- Auto-categorization of extracted transactions (Phase 3)
- Credit-card specific statement schemas beyond the shared format
- Multi-currency FX conversion at extraction time

## Technical notes

- Gemini model: `gemini-2.5-pro` for extraction (better structure fidelity than flash on tables)
- PDF sent inline as base64 (Gemini native PDF, no OCR preprocessing needed)
- Response schema enforced server-side to eliminate hallucinated fields
- Client validates dates & amounts before insert; any row failing validation stays in review with a warning
- All edge function responses include `corsHeaders`; auth via user JWT then org membership check
