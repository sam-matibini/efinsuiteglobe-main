# Phase 4 — AI categorization for Expenses & Bills

Extends the Phase 3 categorization engine from bank transactions to the AP side: expense claim lines and vendor bill lines. Reuses the same edge-function pattern, cache table, rule-learning flow, and review UI.

## What gets built

### 1. Edge function `ai-categorize-ap-lines`
- Input: `{ organization_id, target: "bill" | "expense", line_ids: string[] }`.
- Loads lines from `bill_lines` or `expense_claim_lines` with parent context (vendor name, memo, amount, date).
- Same tiered flow as `ai-categorize-transactions`:
  1. Cache lookup in `ai_formula_cache` with `formula='CATEGORIZE_AP'` keyed by `(org | vendor | normDesc)`.
  2. Gemini Flash fallback with the org's postable expense/COGS/asset accounts as the allowed set.
- Batches 50 lines per model call; enforces the same 2000/day cap via `ai_setup_logs` (`setup_type='ap_categorization'`).
- Returns `{ suggestions: [{ id, gl_account_id, category, confidence, reasoning, source }] }`.

### 2. Rule learning reuse
- `ai-promote-categorization-rules` gains an optional `context: "bank" | "ap"` field (default `"bank"`) so learned AP rules are tagged and don't pollute bank rule matching. Keyword derivation logic unchanged.
- Only `source: "ai"` suggestions are promoted after user accepts.

### 3. Frontend
- New hook `useAPCategorization` mirroring `useAICategorization` with `target` parameter — thin wrapper so the dialog stays generic.
- `AICategorizeDialog` gains a `target` prop (`"bank" | "bill" | "expense"`) that switches:
  - Header copy and empty-state text.
  - The invoke target (bank vs AP function).
  - The apply mutation (updates `bill_lines.gl_account_id` / `expense_claim_lines.gl_account_id`).
- Add "AI Categorize" buttons to:
  - `Bills` detail view (bulk-select lines → open dialog with `target="bill"`).
  - `ExpenseClaims` detail view (bulk-select lines → open dialog with `target="expense"`).

### 4. No schema changes
- Reuses `bill_lines.gl_account_id`, `expense_claim_lines.gl_account_id`, `ai_formula_cache`, `ai_setup_logs`, `transaction_rules`.

## Out of scope
- Auto-categorization on bill/expense creation (opt-in review flow only, same as Phase 3.1 was for bank).
- Tax code suggestion (already handled by tax resolver).
- PO line categorization.

## Technical notes
- Account filter for AP: `account_type IN ('expense','cost_of_goods_sold','other_expense','fixed_asset')` plus any accounts flagged as `is_expense_default`.
- Cache TTL: 30 days, same as bank.
- Reuse `AICategorizeDialog` — no forked dialog component; drive differences from props.
- Confidence default 85% (same as bank), 90% post-creation if we later wire auto-run.

## Files

Created:
- `supabase/functions/ai-categorize-ap-lines/index.ts`
- `src/hooks/useAPCategorization.ts`

Edited:
- `supabase/functions/ai-promote-categorization-rules/index.ts` — add `context` field
- `src/components/banking/AICategorizeDialog.tsx` — generalize with `target` prop
- Bill detail component (e.g. `src/components/purchases/BillDetail*.tsx`) — add "AI Categorize lines" action
- Expense claim detail component (e.g. `src/components/expenses/ExpenseClaimDetail*.tsx`) — add "AI Categorize lines" action
- `.lovable/plan.md` — mark Phase 4 done
