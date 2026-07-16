# Phase 3 — AI Transaction Categorization

Builds on Phases 1, 2, 8. Adds Gemini-powered auto-categorization for `bank_transactions` (and reusable for expenses/bills later). Suggests a GL account + category per transaction, with a confidence score and one-click accept.

## What gets built

### 1. Edge function: `ai-categorize-transactions`
- Input: `{ organization_id, transaction_ids: string[] }` (bank_transactions)
- For each transaction, loads: description, amount, direction, payee, existing category
- Loads org context once: chart of accounts (id, code, name, type), plus recent categorized examples (last 200 rows) to condition the model
- Calls Gemini 2.5 Flash with a strict JSON schema returning per-transaction `{ id, gl_account_id, category, confidence, reasoning }`
- Prefers deterministic matches first (existing `transaction_rules` engine) — only sends unmatched rows to Gemini
- Batch of up to 50 per call; larger inputs are chunked server-side
- Cache: per (org, description-hash + amount-sign) key in `ai_formula_cache` (reuses table, `formula='CATEGORIZE'`) with 30-day TTL — repeated descriptions cost nothing after the first
- Daily cap: 2000 categorizations/day per org, logged to `ai_setup_logs` (`setup_type='transaction_categorization'`)

### 2. Client hook: `useAICategorization`
- `categorize(transactionIds)` → returns suggestions array
- `applySuggestions(accepted[])` → bulk updates `bank_transactions.gl_account_id` + `category`

### 3. UI: inline in Bank Transactions page
- New toolbar button **"AI Categorize"** on the Bank Transactions page
  - Disabled when no rows selected → categorizes selection; if nothing selected, categorizes all uncategorized rows on the current page
- Results appear in a review drawer: transaction | suggested account | confidence badge | Accept / Reject
- **Accept all above X%** slider (default 85%) for one-click bulk apply
- After apply, refresh the transaction list

### 4. No schema changes
- Reuses existing `bank_transactions.gl_account_id`, `bank_transactions.category`
- Reuses `ai_formula_cache` and `ai_setup_logs`

## Out of scope (later phases)
- Auto-categorization on statement extraction (will chain in Phase 3.1)
- Expense/bill categorization (same engine, different caller — later)
- Learning from user corrections into `transaction_rules` (Phase 3.2)

## Technical notes
- Model: `gemini-2.5-flash` (from `GEMINI_MODELS.categorization`) — cheap and fast, sufficient for classification
- Prompt includes only account **name + type**, not full COA metadata, to keep tokens down
- Response schema forces `gl_account_id` to be one of the provided account ids (validated server-side; hallucinated ids dropped with warning)
- Existing `transaction_rules` (already in schema) run first — only unmatched rows hit Gemini
- All confidence scores stored in the review UI state only (not persisted per transaction) — the user's accept is the source of truth
