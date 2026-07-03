
ALTER TABLE public.processor_accounts
  ADD COLUMN IF NOT EXISTS revaluation_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS unrealized_fx_gain_account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS unrealized_fx_loss_account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL;

ALTER TABLE public.settlements
  ADD COLUMN IF NOT EXISTS functional_amount numeric,
  ADD COLUMN IF NOT EXISTS functional_rate numeric,
  ADD COLUMN IF NOT EXISTS last_revalued_at timestamptz;

CREATE TABLE IF NOT EXISTS public.settlement_processor_metrics_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  processor_account_id uuid NOT NULL REFERENCES public.processor_accounts(id) ON DELETE CASCADE,
  metric_date date NOT NULL,
  gross_volume numeric NOT NULL DEFAULT 0,
  net_volume numeric NOT NULL DEFAULT 0,
  fee_total numeric NOT NULL DEFAULT 0,
  chargeback_total numeric NOT NULL DEFAULT 0,
  refund_total numeric NOT NULL DEFAULT 0,
  count_total integer NOT NULL DEFAULT 0,
  count_matched integer NOT NULL DEFAULT 0,
  count_exception integer NOT NULL DEFAULT 0,
  count_written_off integer NOT NULL DEFAULT 0,
  avg_days_to_match numeric,
  match_rate numeric,
  exception_rate numeric,
  refreshed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, processor_account_id, metric_date)
);
GRANT SELECT ON public.settlement_processor_metrics_daily TO authenticated;
GRANT ALL ON public.settlement_processor_metrics_daily TO service_role;
ALTER TABLE public.settlement_processor_metrics_daily ENABLE ROW LEVEL SECURITY;
CREATE POLICY "metrics_org_read" ON public.settlement_processor_metrics_daily
  FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));
CREATE INDEX IF NOT EXISTS idx_spmd_org_date ON public.settlement_processor_metrics_daily(organization_id, metric_date DESC);

CREATE TABLE IF NOT EXISTS public.settlement_fx_revaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  settlement_id uuid NOT NULL REFERENCES public.settlements(id) ON DELETE CASCADE,
  period_end_date date NOT NULL,
  original_currency text NOT NULL,
  original_amount numeric NOT NULL,
  functional_currency text NOT NULL,
  original_rate numeric NOT NULL,
  period_end_rate numeric NOT NULL,
  revaluation_amount numeric NOT NULL,
  journal_entry_id uuid REFERENCES public.journal_entries(id) ON DELETE SET NULL,
  reversal_journal_entry_id uuid REFERENCES public.journal_entries(id) ON DELETE SET NULL,
  reversed_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (settlement_id, period_end_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.settlement_fx_revaluations TO authenticated;
GRANT ALL ON public.settlement_fx_revaluations TO service_role;
ALTER TABLE public.settlement_fx_revaluations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fxrev_org_read" ON public.settlement_fx_revaluations
  FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "fxrev_org_write" ON public.settlement_fx_revaluations
  FOR ALL TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id))
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));
CREATE INDEX IF NOT EXISTS idx_fxrev_org_period ON public.settlement_fx_revaluations(organization_id, period_end_date DESC);

CREATE TABLE IF NOT EXISTS public.settlement_auditor_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','ready','delivered','failed')),
  bundle_storage_path text,
  bundle_sha256 text,
  match_count integer NOT NULL DEFAULT 0,
  writeoff_count integer NOT NULL DEFAULT 0,
  exception_count integer NOT NULL DEFAULT 0,
  fx_revaluation_count integer NOT NULL DEFAULT 0,
  generated_by uuid,
  delivered_to_email text,
  delivered_at timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.settlement_auditor_packages TO authenticated;
GRANT ALL ON public.settlement_auditor_packages TO service_role;
ALTER TABLE public.settlement_auditor_packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audpack_org_read" ON public.settlement_auditor_packages
  FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "audpack_org_insert" ON public.settlement_auditor_packages
  FOR INSERT TO authenticated WITH CHECK (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "audpack_org_update" ON public.settlement_auditor_packages
  FOR UPDATE TO authenticated USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "audpack_admin_delete" ON public.settlement_auditor_packages
  FOR DELETE TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id) AND public.has_role(auth.uid(), 'admin'));
CREATE INDEX IF NOT EXISTS idx_audpack_org_period ON public.settlement_auditor_packages(organization_id, period_end DESC);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_spmd_updated_at') THEN
    CREATE TRIGGER trg_spmd_updated_at BEFORE UPDATE ON public.settlement_processor_metrics_daily
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_fxrev_updated_at') THEN
    CREATE TRIGGER trg_fxrev_updated_at BEFORE UPDATE ON public.settlement_fx_revaluations
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_audpack_updated_at') THEN
    CREATE TRIGGER trg_audpack_updated_at BEFORE UPDATE ON public.settlement_auditor_packages
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.refresh_processor_metrics_daily(_org uuid, _from date, _to date)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected integer := 0;
BEGIN
  INSERT INTO public.settlement_processor_metrics_daily AS m (
    organization_id, processor_account_id, metric_date,
    gross_volume, net_volume, fee_total, chargeback_total, refund_total,
    count_total, count_matched, count_exception, count_written_off,
    avg_days_to_match, match_rate, exception_rate, refreshed_at
  )
  SELECT
    s.organization_id,
    s.processor_account_id,
    s.settlement_date AS metric_date,
    COALESCE(SUM(s.gross_amount), 0),
    COALESCE(SUM(s.net_amount), 0),
    COALESCE(SUM(s.fees), 0),
    COALESCE(SUM(s.chargebacks), 0),
    COALESCE(SUM(s.refunds), 0),
    COUNT(*)::int,
    COUNT(*) FILTER (WHERE s.status IN ('matched','partially_matched'))::int,
    COUNT(*) FILTER (WHERE s.status = 'exception')::int,
    COUNT(*) FILTER (WHERE s.status = 'written_off')::int,
    AVG(EXTRACT(EPOCH FROM (sm.created_at - s.settlement_date::timestamptz)) / 86400.0) FILTER (WHERE sm.created_at IS NOT NULL),
    CASE WHEN COUNT(*) > 0 THEN
      COUNT(*) FILTER (WHERE s.status IN ('matched','partially_matched'))::numeric / COUNT(*)::numeric
    END,
    CASE WHEN COUNT(*) > 0 THEN
      COUNT(*) FILTER (WHERE s.status = 'exception')::numeric / COUNT(*)::numeric
    END,
    now()
  FROM public.settlements s
  LEFT JOIN public.settlement_matches sm ON sm.settlement_id = s.id
  WHERE s.organization_id = _org
    AND s.settlement_date BETWEEN _from AND _to
    AND s.processor_account_id IS NOT NULL
  GROUP BY s.organization_id, s.processor_account_id, s.settlement_date
  ON CONFLICT (organization_id, processor_account_id, metric_date) DO UPDATE SET
    gross_volume = EXCLUDED.gross_volume,
    net_volume = EXCLUDED.net_volume,
    fee_total = EXCLUDED.fee_total,
    chargeback_total = EXCLUDED.chargeback_total,
    refund_total = EXCLUDED.refund_total,
    count_total = EXCLUDED.count_total,
    count_matched = EXCLUDED.count_matched,
    count_exception = EXCLUDED.count_exception,
    count_written_off = EXCLUDED.count_written_off,
    avg_days_to_match = EXCLUDED.avg_days_to_match,
    match_rate = EXCLUDED.match_rate,
    exception_rate = EXCLUDED.exception_rate,
    refreshed_at = now(),
    updated_at = now();
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;
GRANT EXECUTE ON FUNCTION public.refresh_processor_metrics_daily(uuid, date, date) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.settlement_cashflow_projection(_org uuid, _horizon_days integer DEFAULT 30)
RETURNS TABLE (
  expected_date date,
  currency text,
  expected_inflow numeric,
  settlement_count integer
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(s.expected_deposit_date, s.settlement_date + 2) AS expected_date,
    s.currency,
    SUM(s.net_amount)::numeric AS expected_inflow,
    COUNT(*)::int AS settlement_count
  FROM public.settlements s
  WHERE s.organization_id = _org
    AND s.status IN ('pending','partially_matched','exception')
    AND COALESCE(s.expected_deposit_date, s.settlement_date + 2)
        BETWEEN CURRENT_DATE AND CURRENT_DATE + _horizon_days
  GROUP BY 1, 2
  ORDER BY 1;
$$;
GRANT EXECUTE ON FUNCTION public.settlement_cashflow_projection(uuid, integer) TO authenticated, service_role;
