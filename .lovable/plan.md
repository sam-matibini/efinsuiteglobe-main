# Phase 3.1 — Auto-categorize on statement extraction + learn from corrections

Chains Phase 2 (bank statement extraction) into Phase 3 (AI categorization), and closes the loop by promoting user-accepted suggestions into reusable `transaction_rules` so the system gets cheaper and more accurate over time.

## What gets built

### 1. Auto-categorize newly imported rows (Phase 3.1)
- After `BankStatementExtractor` finishes inserting rows into `bank_transactions`, immediately invoke `ai-categorize-transactions` on the freshly inserted IDs.
- Results open in the existing `AICategorizeDialog` in a new `mode="post-import"` where:
  - The dialog auto-opens after import success (no extra click).
  - Header copy switches to "Review AI categorization for imported transactions".
  - Default confidence threshold raised to 90% for auto-select (post-import rows are noisier).
- If the user cancels, rows remain uncategorized (current behavior) — nothing is auto-applied without confirmation.

### 2. Learn from corrections → transaction_rules (Phase 3.2)
- New edge function `ai-promote-categorization-rules`:
  - Input: `{ organization_id, accepted: [{ description, gl_account_id, category }] }`.
  - For each accepted row, derive a normalized keyword (longest meaningful token from description, lowercased, stripped of digits/dates) and upsert into existing `transaction_rules` with `match_type='contains'`, `priority=50`, `source='ai_learned'`.
  - Dedupe: if a rule with the same (org, keyword, gl_account_id) exists, bump `hit_count` instead of inserting.
- `useAICategorization.applySuggestions` calls this function after a successful bulk update, passing only rows where the user accepted an AI (non-rule, non-cache) suggestion.
- Silent: no UI toast on rule creation — surfaces in the existing Banking Rules page.

### 3. UI touch-ups
- `AICategorizeDialog`: small "Learned N new rule(s)" line in the footer after apply when the promote function returns `rules_created > 0`.
- `BankStatementExtractor` review step gains one line: "AI will categorize these transactions after import" (informational only).

### 4. No schema changes
- Reuses `transaction_rules` (already has `source`, `priority`, `hit_count`, `match_type` per existing memory files).
- Reuses `ai_formula_cache` and `ai_setup_logs` from Phase 3.

## Out of scope
- Batch retraining across historical corrections (one-off SQL job, not a feature).
- Expense/bill categorization (Phase 4).
- Rule conflict resolution UI (existing Banking Rules page handles edits).

## Technical notes
- Keyword derivation: split on whitespace, drop tokens matching `/^\d/`, drop tokens < 4 chars, take longest remaining — cheap and deterministic, no extra Gemini call.
- Only rows tagged `source: "ai"` in the suggestion get promoted (rules and cache hits are already covered).
- Post-import auto-open uses a `pendingCategorizationIds` prop threaded through `BankTransactions.tsx` → `AICategorizeDialog`.
- Daily-cap logic already in `ai-categorize-transactions` — no changes needed.

## Files

Created:
- `supabase/functions/ai-promote-categorization-rules/index.ts`

Edited:
- `src/components/banking/BankStatementExtractor.tsx` — chain categorization after import
- `src/components/banking/AICategorizeDialog.tsx` — post-import mode, learned-rules footer
- `src/hooks/useAICategorization.ts` — call promote function after apply
- `src/pages/BankTransactions.tsx` — pass `pendingCategorizationIds` between extractor and dialog
- `.lovable/plan.md` — mark 3.1/3.2 done
