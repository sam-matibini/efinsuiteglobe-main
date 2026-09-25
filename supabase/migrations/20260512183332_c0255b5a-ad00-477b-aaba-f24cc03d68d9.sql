
-- 1. FX DUAL-BALANCE TRIGGER
CREATE OR REPLACE FUNCTION public.enforce_fx_balanced_entry()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entry_id uuid;
  v_status journal_entry_status;
  v_base_dr numeric(20,4);
  v_base_cr numeric(20,4);
  v_diff numeric(20,4);
BEGIN
  v_entry_id := COALESCE(NEW.journal_entry_id, OLD.journal_entry_id);
  IF v_entry_id IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;

  SELECT status INTO v_status FROM public.journal_entries WHERE id = v_entry_id;
  IF v_status IS NULL OR v_status NOT IN ('posted','reversed') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT
    COALESCE(SUM(COALESCE(base_currency_debit, debit)),  0),
    COALESCE(SUM(COALESCE(base_currency_credit, credit)), 0)
  INTO v_base_dr, v_base_cr
  FROM public.journal_entry_lines
  WHERE journal_entry_id = v_entry_id;

  v_diff := ABS(v_base_dr - v_base_cr);
  IF v_diff > 0.01 THEN
    RAISE EXCEPTION 'FX-balanced check failed for journal entry %: base debits=% credits=% diff=%',
      v_entry_id, v_base_dr, v_base_cr, v_diff
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trigger_enforce_fx_balanced_entry ON public.journal_entry_lines;
CREATE CONSTRAINT TRIGGER trigger_enforce_fx_balanced_entry
  AFTER INSERT OR UPDATE OR DELETE ON public.journal_entry_lines
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_fx_balanced_entry();

-- 2. ORG POSTING-FROZEN FLAG
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS posting_frozen boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS posting_frozen_reason text;

-- 3. INTEGRITY FINDINGS
CREATE TABLE IF NOT EXISTS public.integrity_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  check_type text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('info','warning','critical')),
  message text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  detected_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_integrity_findings_org_detected
  ON public.integrity_findings (organization_id, detected_at DESC);

ALTER TABLE public.integrity_findings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members view integrity findings" ON public.integrity_findings;
CREATE POLICY "Org members view integrity findings"
  ON public.integrity_findings FOR SELECT
  TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));

DROP POLICY IF EXISTS "Service role manages integrity findings" ON public.integrity_findings;
CREATE POLICY "Service role manages integrity findings"
  ON public.integrity_findings FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- 4. INTEGRITY CHECK
CREATE OR REPLACE FUNCTION public.integrity_check(p_organization_id uuid)
RETURNS TABLE (check_type text, severity text, message text, payload jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_dr numeric(20,4);
  v_total_cr numeric(20,4);
  v_diff numeric(20,4);
  v_orphans int;
  v_null_fx int;
  v_unbalanced_entries int;
BEGIN
  IF NOT public.is_org_member(auth.uid(), p_organization_id) THEN
    RAISE EXCEPTION 'Not authorized for organization %', p_organization_id
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT
    COALESCE(SUM(COALESCE(jel.base_currency_debit,  jel.debit )),0),
    COALESCE(SUM(COALESCE(jel.base_currency_credit, jel.credit)),0)
  INTO v_total_dr, v_total_cr
  FROM public.journal_entry_lines jel
  JOIN public.journal_entries je ON je.id = jel.journal_entry_id
  WHERE je.organization_id = p_organization_id
    AND je.status IN ('posted','reversed');

  v_diff := ROUND(v_total_dr - v_total_cr, 2);
  IF ABS(v_diff) > 0.01 THEN
    check_type := 'trial_balance';
    severity  := 'critical';
    message   := 'Trial balance is out of balance in base currency.';
    payload   := jsonb_build_object('debits', v_total_dr, 'credits', v_total_cr, 'difference', v_diff);
    RETURN NEXT;
  END IF;

  SELECT COUNT(*) INTO v_unbalanced_entries
  FROM (
    SELECT je.id
    FROM public.journal_entries je
    JOIN public.journal_entry_lines jel ON jel.journal_entry_id = je.id
    WHERE je.organization_id = p_organization_id
      AND je.status IN ('posted','reversed')
    GROUP BY je.id
    HAVING ABS(
      SUM(COALESCE(jel.base_currency_debit,  jel.debit )) -
      SUM(COALESCE(jel.base_currency_credit, jel.credit))
    ) > 0.01
  ) x;

  IF v_unbalanced_entries > 0 THEN
    check_type := 'unbalanced_entries';
    severity  := 'critical';
    message   := format('%s posted journal entries are individually unbalanced.', v_unbalanced_entries);
    payload   := jsonb_build_object('count', v_unbalanced_entries);
    RETURN NEXT;
  END IF;

  SELECT COUNT(*) INTO v_orphans
  FROM public.journal_entry_lines jel
  LEFT JOIN public.journal_entries je ON je.id = jel.journal_entry_id
  WHERE je.id IS NULL;

  IF v_orphans > 0 THEN
    check_type := 'orphan_lines';
    severity  := 'warning';
    message   := format('%s orphan journal entry lines detected.', v_orphans);
    payload   := jsonb_build_object('count', v_orphans);
    RETURN NEXT;
  END IF;

  SELECT COUNT(*) INTO v_null_fx
  FROM public.journal_entry_lines jel
  JOIN public.journal_entries je ON je.id = jel.journal_entry_id
  WHERE je.organization_id = p_organization_id
    AND je.status IN ('posted','reversed')
    AND (jel.base_currency_debit IS NULL OR jel.base_currency_credit IS NULL);

  IF v_null_fx > 0 THEN
    check_type := 'fx_missing_base';
    severity  := 'warning';
    message   := format('%s posted lines missing base-currency amounts.', v_null_fx);
    payload   := jsonb_build_object('count', v_null_fx);
    RETURN NEXT;
  END IF;

  RETURN;
END;
$$;

GRANT EXECUTE ON FUNCTION public.integrity_check(uuid) TO authenticated;

-- 5. RUN + LOG SCAN
CREATE OR REPLACE FUNCTION public.run_integrity_scan(p_organization_id uuid)
RETURNS SETOF public.integrity_findings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  v_inserted public.integrity_findings;
BEGIN
  IF NOT public.is_org_member(auth.uid(), p_organization_id) THEN
    RAISE EXCEPTION 'Not authorized for organization %', p_organization_id
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  FOR r IN SELECT * FROM public.integrity_check(p_organization_id) LOOP
    INSERT INTO public.integrity_findings (organization_id, check_type, severity, message, payload)
    VALUES (p_organization_id, r.check_type, r.severity, r.message, r.payload)
    RETURNING * INTO v_inserted;
    RETURN NEXT v_inserted;
  END LOOP;

  RETURN;
END;
$$;

GRANT EXECUTE ON FUNCTION public.run_integrity_scan(uuid) TO authenticated;
