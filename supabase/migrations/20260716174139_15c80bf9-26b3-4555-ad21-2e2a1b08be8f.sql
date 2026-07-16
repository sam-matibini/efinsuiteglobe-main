CREATE TABLE public.ai_formula_cache (
  organization_id uuid NOT NULL,
  formula text NOT NULL,
  args_hash text NOT NULL,
  value jsonb NOT NULL,
  confidence numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, formula, args_hash)
);

CREATE INDEX ai_formula_cache_created_at_idx ON public.ai_formula_cache (created_at);

GRANT SELECT ON public.ai_formula_cache TO authenticated;
GRANT ALL ON public.ai_formula_cache TO service_role;

ALTER TABLE public.ai_formula_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can read AI formula cache"
  ON public.ai_formula_cache
  FOR SELECT
  TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));