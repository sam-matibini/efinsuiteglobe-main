
ALTER TABLE public.processor_accounts
  ADD COLUMN IF NOT EXISTS auto_approve_threshold integer NOT NULL DEFAULT 95,
  ADD COLUMN IF NOT EXISTS review_threshold integer NOT NULL DEFAULT 80,
  ADD COLUMN IF NOT EXISTS enable_aggregate boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS enable_split boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS auto_match_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_matched_at timestamptz;

ALTER TABLE public.settlement_matches
  ADD COLUMN IF NOT EXISTS match_group_id uuid,
  ADD COLUMN IF NOT EXISTS score_breakdown jsonb,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'auto_matched';

CREATE TABLE IF NOT EXISTS public.settlement_match_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  group_type text NOT NULL CHECK (group_type IN ('aggregate','split')),
  bank_transaction_id uuid,
  settlement_id uuid,
  total_amount numeric(18,2) NOT NULL DEFAULT 0,
  member_count integer NOT NULL DEFAULT 0,
  confidence_score numeric(5,2) NOT NULL DEFAULT 0,
  auto_approved boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending_review',
  reviewed_by uuid,
  reviewed_at timestamptz,
  approved_by uuid,
  approved_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.settlement_match_groups TO authenticated;
GRANT ALL ON public.settlement_match_groups TO service_role;
ALTER TABLE public.settlement_match_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members manage settlement_match_groups"
  ON public.settlement_match_groups FOR ALL TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id))
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));
CREATE INDEX IF NOT EXISTS idx_smg_org_status ON public.settlement_match_groups(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_smg_bank_tx ON public.settlement_match_groups(organization_id, bank_transaction_id);
CREATE INDEX IF NOT EXISTS idx_smg_settlement ON public.settlement_match_groups(organization_id, settlement_id);
CREATE TRIGGER trg_smg_updated_at BEFORE UPDATE ON public.settlement_match_groups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.settlement_matches
  ADD CONSTRAINT settlement_matches_group_fk
  FOREIGN KEY (match_group_id) REFERENCES public.settlement_match_groups(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.settlement_match_group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  group_id uuid NOT NULL REFERENCES public.settlement_match_groups(id) ON DELETE CASCADE,
  settlement_id uuid,
  bank_transaction_id uuid,
  amount numeric(18,2) NOT NULL DEFAULT 0,
  sequence integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.settlement_match_group_members TO authenticated;
GRANT ALL ON public.settlement_match_group_members TO service_role;
ALTER TABLE public.settlement_match_group_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members manage match group members"
  ON public.settlement_match_group_members FOR ALL TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id))
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));
CREATE INDEX IF NOT EXISTS idx_smgm_group ON public.settlement_match_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_smgm_settlement ON public.settlement_match_group_members(organization_id, settlement_id);
CREATE INDEX IF NOT EXISTS idx_smgm_bank_tx ON public.settlement_match_group_members(organization_id, bank_transaction_id);

CREATE TABLE IF NOT EXISTS public.settlement_scoring_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid,
  rule_key text NOT NULL,
  weight numeric(6,2) NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, rule_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.settlement_scoring_rules TO authenticated;
GRANT ALL ON public.settlement_scoring_rules TO service_role;
ALTER TABLE public.settlement_scoring_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read scoring rules (global + own org)"
  ON public.settlement_scoring_rules FOR SELECT TO authenticated
  USING (organization_id IS NULL OR public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "Insert own org scoring rules"
  ON public.settlement_scoring_rules FOR INSERT TO authenticated
  WITH CHECK (organization_id IS NOT NULL AND public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "Update own org scoring rules"
  ON public.settlement_scoring_rules FOR UPDATE TO authenticated
  USING (organization_id IS NOT NULL AND public.is_org_member(auth.uid(), organization_id))
  WITH CHECK (organization_id IS NOT NULL AND public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "Delete own org scoring rules"
  ON public.settlement_scoring_rules FOR DELETE TO authenticated
  USING (organization_id IS NOT NULL AND public.is_org_member(auth.uid(), organization_id));
CREATE TRIGGER trg_ssr_updated_at BEFORE UPDATE ON public.settlement_scoring_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.settlement_scoring_rules (organization_id, rule_key, weight, description) VALUES
  (NULL, 'exact_ref',              40, 'Settlement reference appears in bank tx description/reference'),
  (NULL, 'amount_match',           30, 'Net amount equals bank tx amount within tolerance'),
  (NULL, 'date_within_window',     15, 'Bank tx date is within the configured deposit window'),
  (NULL, 'processor_account_match',10, 'Bank tx posted to the processor''s configured account'),
  (NULL, 'currency_match',          5, 'Currencies match'),
  (NULL, 'description_keyword',     5, 'Description contains processor keyword (stripe/paypal/etc.)'),
  (NULL, 'aggregate_solved',       10, 'Subset-sum aggregate match found'),
  (NULL, 'split_solved',            5, 'Split (1-to-many) match found'),
  (NULL, 'date_gap_penalty',       -2, 'Penalty per day beyond window (capped)')
ON CONFLICT (organization_id, rule_key) DO NOTHING;
