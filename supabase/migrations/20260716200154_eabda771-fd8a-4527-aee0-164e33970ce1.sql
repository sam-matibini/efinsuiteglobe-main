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
  USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "org members insert feedback"
  ON public.ai_categorization_feedback FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));

CREATE INDEX idx_ai_cat_fb_org_created ON public.ai_categorization_feedback (organization_id, created_at DESC);
CREATE INDEX idx_ai_cat_fb_vendor ON public.ai_categorization_feedback (organization_id, context, vendor_key, desc_key);