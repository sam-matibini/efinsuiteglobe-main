# Phase 8 — Categorization surfaces on documents & explainability

Phase 7 shipped revenue-side AI categorization plus an undo audit log. The pipeline is now solid but two gaps remain: users cannot trigger AI categorization directly from invoice / journal / PO detail views, and when auto-apply changes an account there is no "why did the AI pick this?" surface. Phase 8 closes both.

## What gets built

### 1. Reusable "Categorize lines" dialog
- Rename `src/components/purchases/AICategorizeAPDialog.tsx` conceptually to a shared component: extract the review/apply UI into `src/components/ai/AICategorizeLinesDialog.tsx` that accepts:
  - `context: "ap" | "revenue"`
  - `target: "bill" | "expense" | "po" | "invoice" | "journal"`
  - `parentId?: string` — when set, only load uncategorized lines belonging to that parent (single invoice/bill/PO/journal)
- Existing bill/expense usage keeps working via a thin wrapper that re-exports with the AP defaults, so no external call sites break.
- Hook `useLineCategorization` generalizes `useAPCategorization`: routes to `ai-categorize-ap-lines` for AP targets and `ai-categorize-revenue-lines` for revenue targets, and knows which column to update per target (bill/expense → `expense_account_id`, po → `gl_account_id`, invoice → `income_account_id`, journal → `account_id`).

### 2. Detail-view buttons
Add an "AI Categorize Lines" button to each detail view. The button opens the dialog scoped to that parent (`parentId`).
- Invoice detail
- Purchase Order detail
- Journal Entry detail
- (Bill detail and Expense Claim detail already have entry points — no change.)
Each button is gated by `useIsReadOnly` and only shown when at least one line has a null target account.

### 3. Explainability panel
Every auto-applied change records `new_value`, `confidence`, `source`, and (from Phase 5) a Gemini `reasoning` field cached alongside the suggestion. Phase 8 exposes this:
- New helper column in `ai_categorization_applications`: `reasoning text` (nullable). Backfill on write from the suggestion's `reasoning`.
- `AICategorizationHistory` page rows gain an expandable "Why?" row that shows source, confidence, prior → new account, and reasoning.
- Inline hint on `AICategorizeLinesDialog` — when a suggestion has reasoning, show it in a tooltip next to the confidence badge.

### 4. Health widget on revenue lists
- Mount the existing `AICategorizationHealth` widget on the Invoices list and Journal Entries list, filtered to `context="revenue"` so acceptance/override stats are reported separately from AP and bank.
- The health widget already supports a `context` prop; extend it to accept `"revenue"` as a valid value.

### 5. Nav surface
- Add a "Categorization history" entry under the existing AI section of the sidebar (alongside "Categorization insights") so `/ai/categorization-history` is reachable without typing the URL.

## Schema changes

Small additive migration:

```sql
ALTER TABLE public.ai_categorization_applications
  ADD COLUMN IF NOT EXISTS reasoning text;
```

No new tables, no policy changes.

## Out of scope
- Editing auto-apply settings per-scope threshold (org-wide threshold stays).
- AI categorization for recurring invoices, recurring bills, or quotes.
- Explainability for rule-based (non-AI) categorizations — reasoning stays null.

## Files

Created:
- `src/components/ai/AICategorizeLinesDialog.tsx` — generalized dialog
- `src/hooks/useLineCategorization.ts` — generalized categorization hook
- Migration adding `reasoning` column

Edited:
- `src/components/purchases/AICategorizeAPDialog.tsx` → becomes a thin wrapper delegating to the new dialog with `context="ap"`
- `supabase/functions/ai-categorize-transactions/index.ts`, `ai-categorize-ap-lines/index.ts`, `ai-categorize-revenue-lines/index.ts` — persist `reasoning` on the application row
- `src/pages/AICategorizationHistory.tsx` — expandable "Why?" row
- `src/components/banking/AICategorizationHealth.tsx` — accept `"revenue"` context
- Invoice detail component — add button
- Purchase Order detail component — add button
- Journal Entry detail component — add button
- Invoices list + Journal Entries list — mount health widget with revenue context
- Sidebar nav config — add "Categorization history" link
- `.lovable/plan.md` — Phase 8 entry
