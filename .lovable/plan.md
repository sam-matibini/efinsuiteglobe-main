# Gemini integration — Phase 1 + Phase 8

Scope locked to your answers: build a centralized Gemini AI service layer with direct Google AI Studio access, hardcoded per-module model defaults, then wire it into AI Sheets with new AI formulas (`=AI`, `=CLASSIFY`, `=EXPLAIN`, `=SUMMARIZE`, `=PREDICT`, `=ANALYZE`, `=GENERATE_JE`).

Everything else in the 15-phase spec (bank OCR, reconciliation, journals, fraud, etc.) is out of scope for this round.

---

## Phase 1 — Google AI service layer

### 1.1 Secrets
Ask the user (via `add_secret`) for:
- `GOOGLE_AI_API_KEY` (required — Google AI Studio key)
- `GOOGLE_PROJECT_ID` (optional, Vertex only)
- `GOOGLE_LOCATION` (optional, Vertex only; default `us-central1`)

Server-only. Never exposed to the browser.

### 1.2 Shared Gemini client (edge functions)
New file `supabase/functions/_shared/gemini.ts`:
- `callGemini({ model, system, messages, tools?, jsonSchema?, images? })` — thin wrapper over `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`.
- `streamGemini(...)` for future streaming use.
- Handles: image parts (base64 `inlineData`), function-calling tools, JSON mode (`responseMimeType: application/json` + `responseSchema`), retry on 429/5xx with backoff, surfacing `error.message` verbatim.
- Reads `GOOGLE_AI_API_KEY` from `Deno.env`.

### 1.3 Hardcoded model registry
`supabase/functions/_shared/geminiModels.ts` — one map, no admin UI yet:

```
bankOcr        → gemini-2.5-pro       (vision + long context)
aliceSheets    → gemini-2.5-pro
aliceChat      → gemini-2.5-pro
documentAnalysis → gemini-2.5-pro
financialReports → gemini-2.5-flash
categorization → gemini-2.5-flash
```

Exported as `GEMINI_MODELS.aliceSheets` etc. Change in one place later.

### 1.4 Verify endpoint
New `supabase/functions/gemini-health/index.ts` — `POST` returns `{ ok, model, latencyMs }`. Used by an admin ping and by us to confirm the key works.

Nothing in the existing app (compilation reports, banking, etc.) is touched.

---

## Phase 8 — AI Sheets formulas

### 2.1 New edge function `ai-sheets-formula`
`supabase/functions/ai-sheets-formula/index.ts`:
- Auth: verifies Supabase JWT, checks `is_org_member`.
- Input: `{ organization_id, formula: "CLASSIFY" | "EXPLAIN" | "SUMMARIZE" | "PREDICT" | "ANALYZE" | "GENERATE_JE" | "AI", args: unknown[], context?: { columns, sampleRows } }`.
- Routes each formula to a purpose-built Gemini prompt via `callGemini` using `GEMINI_MODELS.aliceSheets`.
- Uses JSON-mode with narrow schemas for `CLASSIFY` (single label), `GENERATE_JE` (array of debit/credit lines), `PREDICT` (numeric value + confidence). Free-text for `EXPLAIN`, `SUMMARIZE`, `ANALYZE`, `AI`.
- Response cached per `(formula, hash(args))` for 24h in a new `ai_formula_cache` table so a sheet re-render doesn't re-bill every cell.
- Returns `{ value, confidence?, explanation? }`.

### 2.2 Rate/cost guardrails
- Per-org daily call cap (default 500 — configurable in `organization_settings.ai_daily_cap`, read-only for now).
- Never batch more than 20 formula cells in a single client burst; queue the rest with 200ms spacing.

### 2.3 Migration
```
ai_formula_cache(
  org_id uuid, formula text, args_hash text,
  value jsonb, confidence numeric, created_at timestamptz,
  primary key (org_id, formula, args_hash)
)
```
With grants + RLS scoped to org members (service_role writes).

### 2.4 Client formula engine wiring
Extend `src/lib/formulaEngine.ts` (or nearest equivalent used by `AISheets.tsx` — will confirm on read):
- Register async functions `AI`, `CLASSIFY`, `EXPLAIN`, `SUMMARIZE`, `PREDICT`, `FORECAST` (alias of PREDICT), `ANALYZE`, `GENERATE_JE`.
- Each returns a `Promise<string | number>`; the sheet renders `⏳` placeholder while pending, then the resolved value.
- Errors surface inline (`#AI_ERR: rate limited`) instead of throwing.
- All calls go through `supabase.functions.invoke('ai-sheets-formula', ...)`; no API key ever reaches the browser.

### 2.5 UI touches (AISheets.tsx)
- Formula autocomplete gains the new AI functions with tooltips + examples.
- A subtle "AI cell" indicator (spark icon) on cells whose formula starts with one of the AI functions.
- Toast on 429 / 402 / auth errors returned by the edge function.

Nothing else in AI Sheets changes — sort/filter/pivot/etc. keep working.

---

## Verification

1. `gemini-health` returns `ok: true` in the browser after secrets are set.
2. In an AI Sheet, `=CLASSIFY(A2)` on a row like "Tim Hortons $8.40" returns a category (e.g. "Meals & Entertainment") with confidence.
3. `=EXPLAIN("Balance sheet current liabilities up 22%")` returns a paragraph.
4. `=GENERATE_JE(A2:H2)` returns a structured multi-line journal entry rendered across cells.
5. Re-running the same formula hits the cache (visible latency drop; no new Google spend — verified via `ai_formula_cache` row count).
6. Removing `GOOGLE_AI_API_KEY` makes AI formulas fail cleanly with a user-visible error, and every non-AI feature keeps working.

---

## Explicitly out of scope this round
Bank PDF OCR, AI reconciliation, AI journal generation from bank feeds, banking insights, fraud detection, document intelligence, learning engine, confidence-scoring dashboard, banking module rewrites, security/compliance framework, admin model-picker UI. Each is a follow-up phase once Phase 1 + 8 are stable.
