# Phase 7 — Revenue-side AI categorization & undo/rollback

Phases 3–6 covered AP/bank auto-categorization with feedback learning, safety rails, and scheduled sweeps. Phase 7 extends coverage to the revenue side (invoices, journal entries) and adds an undo/rollback surface so auto-applied categorizations are recoverable.

## What gets built

### 1. Revenue-side categorization (invoices + manual journal entries)
- New edge function `ai-categorize-revenue-lines` mirroring `ai-categorize-ap-lines`:
  - `target: "invoice" | "journal"` → writes to `invoice_lines.revenue_account_id` or `journal_entry_lines.account_id` (only for lines flagged `pending_ai=true` or with null account).
  - Reuses the rule/cache/AI cascade from AP with a revenue-oriented system prompt (income accounts, deferred revenue, contra-revenue).
  - Supports the same `auto_apply` flag with the org-level threshold + 80% acceptance safety rail already enforced in Phase 6.
- Feedback goes through the existing `ai-record-categorization-feedback` with `context="revenue"` and `target` in `{invoice, journal}`.
- Insights hook + health widget filter by context so revenue and AP stats stay separate.

### 2. Auto-apply scope expansion
- Add `invoice` and `journal` values to `ai_categorization_settings.auto_apply_scopes`.
- Sweep function (`ai-categorize-sweep`) picks up:
  - `invoice_lines` with null `revenue_account_id` for invoices in `draft` status only (never touch posted invoices).
  - `journal_entry_lines` with null `account_id` for entries in `draft` status only.
- Settings panel gains two new scope checkboxes with a clear "draft only" note.

### 3. Undo / rollback surface
- New table `ai_categorization_applications` recording every auto-apply (org, target, row id, prior value, new value, confidence, source, feedback id, applied_at, undone_at).
- Both `ai-categorize-transactions` and `ai-categorize-ap-lines` (and the new revenue function) write one row per auto-applied line.
- New edge function `ai-undo-categorization`:
  - Accepts an application id (or bulk ids). Restores the prior value on the target row, marks the application undone, and logs a corrective feedback row so the model learns from the reversal.
- New page `/ai/categorization-history` shows the last 30 days of auto-applied changes with per-row Undo, a bulk "Undo last sweep" action, and filters by scope/date.

### 4. Frontend surfaces
- Invoice detail view: "AI Categorize Lines" button opening the existing `AICategorizeAPDialog` refactored to accept `context="revenue"` + `target="invoice"` (rename to `AICategorizeLinesDialog`, keep AP callsites working).
- Journal Entry detail view: same button with `target="journal"`.
- Invoices list + Journal Entries list: mount `AICategorizationHealth` filtered to revenue context.
- Add "Categorization History" nav entry under Settings > AI alongside Insights.

### 5. Safety
- Auto-apply for revenue is gated the same way as AP: `auto_apply_enabled` + scope in `auto_apply_scopes` + 30-day acceptance rate ≥ 80% for that scope.
- Posted / issued invoices and posted journals are never touched, regardless of settings.
- Undo is disabled once a downstream event has locked the row (invoice issued, journal posted, period locked).

## Schema changes

```sql
CREATE TABLE public.ai_categorization_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  context text NOT NULL,        -- 'bank' | 'ap' | 'revenue'
  target text NOT NULL,         -- 'bank' | 'bill' | 'expense' | 'po' | 'invoice' | 'journal'
  row_id uuid NOT NULL,
  prior_value jsonb,
  new_value jsonb NOT NULL,
  confidence numeric,
  source text,
  feedback_id uuid,
  applied_at timestamptz NOT NULL DEFAULT now(),
  undone_at timestamptz,
  undone_by uuid
);
-- GRANT + RLS via is_org_member / is_org_admin, mirroring ai_categorization_settings.
-- Also: ALTER TABLE ai_categorization_settings so auto_apply_scopes CHECK accepts the new values (drop old check, add new).
```

## Out of scope
- Auto-apply for issued/posted rows (only draft).
- Model fine-tuning per org.
- Undo across period locks or fiscal-year closes.

## Files

Created:
- `supabase/functions/ai-categorize-revenue-lines/index.ts`
- `supabase/functions/ai-undo-categorization/index.ts`
- `src/pages/AICategorizationHistory.tsx`
- `src/hooks/useAICategorizationHistory.ts`
- Migration for `ai_categorization_applications` + scope check update

Edited:
- `supabase/functions/ai-categorize-transactions/index.ts` — log applications
- `supabase/functions/ai-categorize-ap-lines/index.ts` — log applications
- `supabase/functions/ai-categorize-sweep/index.ts` — add `invoice`/`journal` scopes
- `supabase/functions/ai-record-categorization-feedback/index.ts` — accept `revenue` context + `invoice`/`journal` targets
- `src/components/purchases/AICategorizeAPDialog.tsx` → rename/generalize to `AICategorizeLinesDialog`
- `src/components/settings/AICategorizationAutoApplySettings.tsx` — add invoice/journal scope toggles
- Invoice + Journal Entry detail components — add AI Categorize button
- Invoices + Journal Entries list pages — mount health widget
- `src/App.tsx` — route `/ai/categorization-history`
- `.lovable/plan.md` — Phase 7 entry
