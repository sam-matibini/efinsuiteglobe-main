
-- Broaden feedback CHECK constraints
ALTER TABLE public.ai_categorization_feedback
  DROP CONSTRAINT IF EXISTS ai_categorization_feedback_context_check;
ALTER TABLE public.ai_categorization_feedback
  ADD CONSTRAINT ai_categorization_feedback_context_check
  CHECK (context IN ('bank','ap','revenue'));

ALTER TABLE public.ai_categorization_feedback
  DROP CONSTRAINT IF EXISTS ai_categorization_feedback_target_check;
ALTER TABLE public.ai_categorization_feedback
  ADD CONSTRAINT ai_categorization_feedback_target_check
  CHECK (target IN ('bank_transaction','bill','expense','po','invoice','journal'));

-- Applications audit log
CREATE TABLE public.ai_categorization_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  context text NOT NULL CHECK (context IN ('bank','ap','revenue')),
  target text NOT NULL CHECK (target IN ('bank_transaction','bill','expense','po','invoice','journal')),
  row_id uuid NOT NULL,
  prior_value jsonb,
  new_value jsonb NOT NULL,
  confidence numeric(4,3),
  source text CHECK (source IN ('cache','ai','rule','manual')),
  feedback_id uuid,
  applied_at timestamptz NOT NULL DEFAULT now(),
  undone_at timestamptz,
  undone_by uuid REFERENCES auth.users(id)
);

GRANT SELECT, INSERT, UPDATE ON public.ai_categorization_applications TO authenticated;
GRANT ALL ON public.ai_categorization_applications TO service_role;

ALTER TABLE public.ai_categorization_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members read cat applications"
  ON public.ai_categorization_applications FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "org members insert cat applications"
  ON public.ai_categorization_applications FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "org members update cat applications"
  ON public.ai_categorization_applications FOR UPDATE TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id))
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));

CREATE INDEX idx_ai_cat_apps_org_applied
  ON public.ai_categorization_applications (organization_id, applied_at DESC);
CREATE INDEX idx_ai_cat_apps_row
  ON public.ai_categorization_applications (target, row_id);
