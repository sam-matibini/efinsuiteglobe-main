# Phase 5 — Continuous learning & categorization analytics (done)

Phases 3–4 shipped one-shot AI categorization for bank, bill, and expense lines with rule promotion. Phase 5 closes the loop: measure how well AI + learned rules are doing, feed corrections back, and surface it in the UI.

## What gets built

### 1. Feedback capture
- New edge function `ai-record-categorization-feedback`.
- Input: `{ organization_id, context: "bank" | "ap", items: [{ line_id, target, suggested_account_id, final_account_id, source, confidence }] }`.
- Writes to a new `ai_categorization_feedback` table (see schema below).
- Called from `AICategorizeDialog` / `AICategorizeAPDialog` on Apply — records both accepted (suggested == final) and overridden (suggested != final) rows.

### 2. Cache correction
- When `suggested != final` and `source in ('cache','ai')`, the same function invalidates the matching `ai_formula_cache` row (delete by `args_hash`) so the next run re-asks the model instead of repeating a bad answer.
- If overrides for the same `(vendor|normDesc)` key cross a threshold (≥ 3 with the same corrected account), auto-promote a `transaction_rules` / AP rule via existing `ai-promote-categorization-rules` (reused, context-aware).

### 3. Analytics view
- New page `src/pages/AICategorizationInsights.tsx` (route `/ai/categorization-insights`) plus a card on the existing AI settings/dashboard area.
- Reads `ai_categorization_feedback` + `ai_setup_logs` (setup_type in `categorization`, `ap_categorization`) and shows:
  - Volume: lines categorized per day, split by context (bank/bill/expense).
  - Quality: acceptance rate, override rate, avg confidence, cache-hit rate.
  - Top corrections: `(vendor, wrong_account → right_account, count)` — one-click "Promote to rule".
  - Daily cap usage vs 2000 limit.
- Small `<AICategorizationHealth />` widget on the bank + AP list pages for at-a-glance acceptance %.

### 4. Dialog wiring
- `AICategorizeDialog` and `AICategorizeAPDialog` call the feedback function inside their existing Apply mutation. No new user-facing steps.
- Track which suggestions were edited before apply so we can distinguish accepted vs overridden.

## Schema changes

One migration:

```sql
CREATE TABLE public.ai_categorization_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  context text NOT NULL CHECK (context IN ('bank','ap')),
  target text NOT NULL CHECK (target IN ('bank_transaction','bill','expense')),
  line_id uuid NOT NULL,
  suggested_account_id uuid,
  final_account_id uuid,
  source text CHECK (source IN ('cache','ai','none','manual')),
  confidence numeric(4,3),
  accepted boolean GENERATED ALWAYS AS (suggested_account_id IS NOT DISTINCT FROM final_account_id) STORED,
  vendor_key text,
  desc_key text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.ai_categorization_feedback TO authenticated;
GRANT ALL ON public.ai_categorization_feedback TO service_role;
ALTER TABLE public.ai_categorization_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members read feedback"
  ON public.ai_categorization_feedback FOR SELECT TO authenticated
  USING (is_org_member(auth.uid(), organization_id));
CREATE POLICY "org members insert feedback"
  ON public.ai_categorization_feedback FOR INSERT TO authenticated
  WITH CHECK (is_org_member(auth.uid(), organization_id));

CREATE INDEX idx_ai_cat_fb_org_created ON public.ai_categorization_feedback (organization_id, created_at DESC);
CREATE INDEX idx_ai_cat_fb_vendor ON public.ai_categorization_feedback (organization_id, context, vendor_key, desc_key);
```

No changes to existing tables.

## Out of scope
- Retraining a custom model — we only steer via cache invalidation + rule promotion.
- Cross-org learning.
- Auto-apply high-confidence categorizations without review (still opt-in).

## Files

Created:
- `supabase/functions/ai-record-categorization-feedback/index.ts`
- `src/pages/AICategorizationInsights.tsx`
- `src/components/banking/AICategorizationHealth.tsx`
- `src/hooks/useAICategorizationInsights.ts`

Edited:
- `src/components/banking/AICategorizeDialog.tsx` — record feedback on apply
- `src/components/purchases/AICategorizeAPDialog.tsx` — record feedback on apply
- `src/hooks/useAICategorization.ts` — expose overridden vs accepted
- `src/hooks/useAPCategorization.ts` — same
- `src/App.tsx` (or router file) — add `/ai/categorization-insights` route
- `.lovable/plan.md` — mark Phase 5 done
