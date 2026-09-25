-- ====== Extend processor_accounts ======
ALTER TABLE public.processor_accounts
  ADD COLUMN IF NOT EXISTS require_dual_approval boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS dual_approval_threshold numeric NOT NULL DEFAULT 1000,
  ADD COLUMN IF NOT EXISTS default_writeoff_account_id uuid REFERENCES public.accounts(id);

-- ====== Extend settlement_matches ======
ALTER TABLE public.settlement_matches
  ADD COLUMN IF NOT EXISTS preparer_user_id uuid,
  ADD COLUMN IF NOT EXISTS approver_user_id uuid,
  ADD COLUMN IF NOT EXISTS requires_second_approval boolean NOT NULL DEFAULT false;

-- ====== Write-offs table ======
CREATE TABLE IF NOT EXISTS public.settlement_writeoffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  settlement_id uuid NOT NULL UNIQUE REFERENCES public.settlements(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  writeoff_account_id uuid NOT NULL REFERENCES public.accounts(id),
  journal_entry_id uuid REFERENCES public.journal_entries(id),
  reason text,
  written_off_by uuid,
  written_off_at timestamptz NOT NULL DEFAULT now(),
  reversed_at timestamptz,
  reversal_journal_entry_id uuid REFERENCES public.journal_entries(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_writeoffs_org ON public.settlement_writeoffs(organization_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.settlement_writeoffs TO authenticated;
GRANT ALL ON public.settlement_writeoffs TO service_role;
ALTER TABLE public.settlement_writeoffs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members manage settlement writeoffs" ON public.settlement_writeoffs
  FOR ALL TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id))
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));

ALTER TABLE public.settlements
  ADD COLUMN IF NOT EXISTS writeoff_id uuid REFERENCES public.settlement_writeoffs(id) ON DELETE SET NULL;

-- ====== Approval steps table ======
CREATE TABLE IF NOT EXISTS public.settlement_approval_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  match_id uuid REFERENCES public.settlement_matches(id) ON DELETE CASCADE,
  match_group_id uuid REFERENCES public.settlement_match_groups(id) ON DELETE CASCADE,
  step_number integer NOT NULL CHECK (step_number IN (1,2)),
  approver_user_id uuid NOT NULL,
  decision text NOT NULL CHECK (decision IN ('approve','reject')),
  decided_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((match_id IS NOT NULL) <> (match_group_id IS NOT NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_approval_match_step ON public.settlement_approval_steps(match_id, step_number) WHERE match_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_approval_group_step ON public.settlement_approval_steps(match_group_id, step_number) WHERE match_group_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.settlement_approval_steps TO authenticated;
GRANT ALL ON public.settlement_approval_steps TO service_role;
ALTER TABLE public.settlement_approval_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members manage approval steps" ON public.settlement_approval_steps
  FOR ALL TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id))
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));

-- ====== Period lock function ======
CREATE OR REPLACE FUNCTION public.assert_settlement_period_open(_org uuid, _date date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  locked boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.fiscal_periods
    WHERE organization_id = _org
      AND _date BETWEEN start_date AND end_date
      AND status = 'closed'
  ) INTO locked;
  IF locked THEN
    RAISE EXCEPTION 'PERIOD_LOCKED: %', _date USING ERRCODE = 'P0001';
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.assert_settlement_period_open(uuid, date) TO authenticated, service_role;

-- ====== Triggers ======
CREATE OR REPLACE FUNCTION public.tg_settlement_matches_period_lock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s_date date;
BEGIN
  SELECT COALESCE(expected_deposit_date, settlement_date) INTO s_date
  FROM public.settlements WHERE id = NEW.settlement_id;
  IF s_date IS NOT NULL THEN
    PERFORM public.assert_settlement_period_open(NEW.organization_id, s_date);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_settlement_matches_period_lock ON public.settlement_matches;
CREATE TRIGGER trg_settlement_matches_period_lock
  BEFORE INSERT OR UPDATE ON public.settlement_matches
  FOR EACH ROW EXECUTE FUNCTION public.tg_settlement_matches_period_lock();

CREATE OR REPLACE FUNCTION public.tg_settlement_writeoffs_period_lock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_settlement_period_open(NEW.organization_id, NEW.written_off_at::date);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_settlement_writeoffs_period_lock ON public.settlement_writeoffs;
CREATE TRIGGER trg_settlement_writeoffs_period_lock
  BEFORE INSERT ON public.settlement_writeoffs
  FOR EACH ROW EXECUTE FUNCTION public.tg_settlement_writeoffs_period_lock();

-- updated_at trigger for writeoffs
DROP TRIGGER IF EXISTS trg_settlement_writeoffs_updated_at ON public.settlement_writeoffs;
CREATE TRIGGER trg_settlement_writeoffs_updated_at
  BEFORE UPDATE ON public.settlement_writeoffs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();