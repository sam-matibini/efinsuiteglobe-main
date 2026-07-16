# Phase 6 — Auto-apply high-confidence categorizations & PO line coverage

Phases 3–5 shipped review-based categorization with feedback learning. Phase 6 removes the review step for high-confidence, high-trust cases and extends coverage to purchase orders.

## What gets built

### 1. Org-level auto-apply setting
- New row in the existing `organization_ai_settings` (or fall back to a small new table if that doesn't exist — TBD after inspection) storing:
  - `ai_categorization_auto_apply_enabled` (bool, default false)
  - `ai_categorization_auto_apply_threshold` (int, default 95) — confidence percentage
  - `ai_categorization_auto_apply_scopes` (text[], subset of `bank`, `bill`, `expense`, `po`)
- Settings UI panel `AICategorizationAutoApplySettings.tsx` under Settings > AI. Shows current acceptance rate from the insights hook so users see whether they should trust auto-apply.
- Auto-apply is gated on both the org setting AND the per-scope acceptance rate over the last 30 days being ≥ 80% (safety rail — if the model is being overridden a lot, we do not auto-apply regardless of the toggle).

### 2. Auto-apply pipeline
- Edge functions `ai-categorize-transactions` and `ai-categorize-ap-lines` gain an optional `auto_apply: boolean` request field.
- When `auto_apply=true` and the caller passes the setting check (evaluated server-side), suggestions with `confidence >= threshold/100` AND `source in ('rule','cache','ai')` are written directly to the target table inside the same function, and their ids are returned in `auto_applied: string[]`.
- Feedback rows are inserted with `final = suggested` and `source` preserved so acceptance-rate stats stay honest.
- The remaining below-threshold / low-source suggestions still come back for review as today.
- Callers that already open the review dialog keep working; new callers (post-import chain, scheduled sweeps) can pass `auto_apply: true`.

### 3. Scheduled sweep
- New edge function `ai-categorize-sweep` (cron via `supabase/config.toml` schedule) runs nightly per org that has auto-apply enabled:
  - Picks up uncategorized bank txns, bill lines, expense lines (limit 500 per scope).
  - Invokes the categorize functions with `auto_apply: true`.
  - Writes a summary row to `ai_setup_logs` (`setup_type='auto_apply_sweep'`).

### 4. Purchase order line categorization (new AP scope)
- Extend `ai-categorize-ap-lines` `target` union with `"po"` targeting `purchase_order_lines.gl_account_id`.
- Add "AI Categorize Lines" action to Purchase Orders detail view, using the existing `AICategorizeAPDialog` with `target="po"`.
- Feedback logging + rule learning reuse Phase 5 with `context="ap"` and `target="po"`.

### 5. Frontend surfaces
- Add `AICategorizationHealth` widget to Bills, Expense Claims, and Purchase Orders list pages (mirrors bank).
- Add "AI Insights" nav entry under Settings so `/ai/categorization-insights` is reachable without knowing the URL.
- On auto-apply toggle change, invalidate the insights query so the UI reflects new settings.

## Schema changes

Only if `organization_ai_settings` (or equivalent) does not already exist. Otherwise the migration is `ALTER TABLE ... ADD COLUMN` for the three new fields with defaults. If a new table is needed:

```sql
CREATE TABLE public.ai_categorization_settings (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  auto_apply_enabled boolean NOT NULL DEFAULT false,
  auto_apply_threshold integer NOT NULL DEFAULT 95 CHECK (auto_apply_threshold BETWEEN 50 AND 100),
  auto_apply_scopes text[] NOT NULL DEFAULT ARRAY[]::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.ai_categorization_settings TO authenticated;
GRANT ALL ON public.ai_categorization_settings TO service_role;
ALTER TABLE public.ai_categorization_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members read settings"
  ON public.ai_categorization_settings FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "org admins write settings"
  ON public.ai_categorization_settings FOR ALL TO authenticated
  USING (public.is_org_admin(auth.uid(), organization_id))
  WITH CHECK (public.is_org_admin(auth.uid(), organization_id));
```

## Out of scope
- Auto-apply for journal entries and invoices (revenue side has different risk profile).
- Undo/rollback of auto-applied categorizations (users still edit the target row manually; feedback loop covers repeated mistakes).
- Cross-org model tuning.

## Files

Created:
- `supabase/functions/ai-categorize-sweep/index.ts`
- `src/components/settings/AICategorizationAutoApplySettings.tsx`
- `src/hooks/useAICategorizationSettings.ts`

Edited:
- `supabase/functions/ai-categorize-transactions/index.ts` — accept `auto_apply`, apply high-confidence rows server-side, return `auto_applied`
- `supabase/functions/ai-categorize-ap-lines/index.ts` — same, plus support `target="po"` against `purchase_order_lines`
- `supabase/functions/ai-record-categorization-feedback/index.ts` — accept `"po"` target
- Purchase Orders detail component — add "AI Categorize Lines" button opening `AICategorizeAPDialog` with `target="po"`
- `src/components/purchases/AICategorizeAPDialog.tsx` — accept `target="po"`, load PO lines
- `src/hooks/useAPCategorization.ts` — accept `target="po"` and update `purchase_order_lines`
- Bills / Expense Claims / Purchase Orders list pages — mount `AICategorizationHealth`
- Settings nav / router — link to `/ai/categorization-insights` and the auto-apply settings panel
- Migration for `ai_categorization_settings` (only if the existing settings table doesn't already cover this)
- `.lovable/plan.md` — mark Phase 6 done
