ALTER TABLE public.processor_accounts
  ADD COLUMN IF NOT EXISTS enable_fuzzy_matching boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS fuzzy_min_similarity numeric NOT NULL DEFAULT 0.75,
  ADD COLUMN IF NOT EXISTS auto_match_schedule text NOT NULL DEFAULT '*/15 * * * *',
  ADD COLUMN IF NOT EXISTS auto_match_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_auto_match_at timestamptz;

ALTER TABLE public.settlements
  ADD COLUMN IF NOT EXISTS aging_bucket text,
  ADD COLUMN IF NOT EXISTS exception_reason text,
  ADD COLUMN IF NOT EXISTS last_match_attempt_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_settlements_aging ON public.settlements(organization_id, aging_bucket) WHERE status IN ('pending','exception');

CREATE TABLE IF NOT EXISTS public.settlement_fuzzy_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  settlement_id uuid NOT NULL REFERENCES public.settlements(id) ON DELETE CASCADE,
  bank_transaction_id uuid NOT NULL REFERENCES public.bank_transactions(id) ON DELETE CASCADE,
  similarity_score numeric NOT NULL DEFAULT 0,
  amount_delta numeric NOT NULL DEFAULT 0,
  date_delta_days integer NOT NULL DEFAULT 0,
  total_score numeric NOT NULL DEFAULT 0,
  breakdown jsonb,
  computed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (settlement_id, bank_transaction_id)
);

CREATE INDEX IF NOT EXISTS idx_fuzzy_candidates_settlement ON public.settlement_fuzzy_candidates(settlement_id, total_score DESC);
CREATE INDEX IF NOT EXISTS idx_fuzzy_candidates_org ON public.settlement_fuzzy_candidates(organization_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.settlement_fuzzy_candidates TO authenticated;
GRANT ALL ON public.settlement_fuzzy_candidates TO service_role;

ALTER TABLE public.settlement_fuzzy_candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members manage fuzzy candidates"
  ON public.settlement_fuzzy_candidates
  FOR ALL
  TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id))
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));

INSERT INTO public.settlement_scoring_rules (rule_key, weight, is_active, description, organization_id)
VALUES
  ('fuzzy_ref_similarity', 25, true, 'Jaro-Winkler similarity of normalized reference (Level 5 fuzzy)', NULL),
  ('merchant_token_match', 10, true, 'Shared tokens between settlement and bank description (Level 5 fuzzy)', NULL)
ON CONFLICT (organization_id, rule_key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.refresh_settlement_aging(_org uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected integer;
BEGIN
  UPDATE public.settlements s
  SET aging_bucket = CASE
    WHEN (now()::date - COALESCE(s.expected_deposit_date, s.settlement_date)) <= 3 THEN '0-3d'
    WHEN (now()::date - COALESCE(s.expected_deposit_date, s.settlement_date)) <= 7 THEN '4-7d'
    WHEN (now()::date - COALESCE(s.expected_deposit_date, s.settlement_date)) <= 14 THEN '8-14d'
    WHEN (now()::date - COALESCE(s.expected_deposit_date, s.settlement_date)) <= 30 THEN '15-30d'
    ELSE '30d+'
  END
  WHERE s.status IN ('pending','exception')
    AND (_org IS NULL OR s.organization_id = _org);
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

GRANT EXECUTE ON FUNCTION public.refresh_settlement_aging(uuid) TO authenticated, service_role;