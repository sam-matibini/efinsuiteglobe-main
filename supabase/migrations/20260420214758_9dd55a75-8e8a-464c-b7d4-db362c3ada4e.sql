-- ============================================================================
-- PHASE 1: Multi-Currency Engine Foundation
-- ============================================================================

-- 1. Extend organizations
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS multi_currency_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reporting_currency text,
  ADD COLUMN IF NOT EXISTS base_currency_locked_at timestamptz,
  ADD COLUMN IF NOT EXISTS realized_fx_account_id uuid REFERENCES public.accounts(id),
  ADD COLUMN IF NOT EXISTS unrealized_fx_account_id uuid REFERENCES public.accounts(id),
  ADD COLUMN IF NOT EXISTS cta_account_id uuid REFERENCES public.accounts(id),
  ADD COLUMN IF NOT EXISTS fx_rate_source text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS fx_rate_sync_frequency text NOT NULL DEFAULT 'daily';

-- 2. Default currency for customers / vendors
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS default_currency text;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS default_currency text;

-- 3. Currency revaluations (header)
CREATE TABLE IF NOT EXISTS public.currency_revaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  period_end date NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','posted','reversed')),
  journal_entry_id uuid REFERENCES public.journal_entries(id),
  reversal_journal_entry_id uuid REFERENCES public.journal_entries(id),
  total_unrealized_gain numeric(18,4) NOT NULL DEFAULT 0,
  total_unrealized_loss numeric(18,4) NOT NULL DEFAULT 0,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_currency_revaluations_org ON public.currency_revaluations(organization_id, period_end DESC);

-- 4. Currency revaluation lines
CREATE TABLE IF NOT EXISTS public.currency_revaluation_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  revaluation_id uuid NOT NULL REFERENCES public.currency_revaluations(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.accounts(id),
  currency text NOT NULL,
  balance_fc numeric(18,4) NOT NULL,
  historical_rate numeric(18,8),
  closing_rate numeric(18,8) NOT NULL,
  base_balance_before numeric(18,4) NOT NULL,
  base_balance_after numeric(18,4) NOT NULL,
  gain_loss numeric(18,4) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_currency_revaluation_lines_reval ON public.currency_revaluation_lines(revaluation_id);

-- 5. Exchange rate locks
CREATE TABLE IF NOT EXISTS public.exchange_rate_locks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  period_end date NOT NULL,
  locked boolean NOT NULL DEFAULT true,
  locked_by uuid REFERENCES auth.users(id),
  locked_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  UNIQUE (organization_id, period_end)
);

-- 6. Exchange rate audit
CREATE TABLE IF NOT EXISTS public.exchange_rate_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  exchange_rate_id uuid,
  from_currency text NOT NULL,
  to_currency text NOT NULL,
  effective_date date NOT NULL,
  old_rate numeric(18,8),
  new_rate numeric(18,8) NOT NULL,
  action text NOT NULL CHECK (action IN ('insert','update','delete')),
  source text,
  performed_by uuid REFERENCES auth.users(id),
  performed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_exchange_rate_audit_org ON public.exchange_rate_audit(organization_id, performed_at DESC);

-- 7. Helper: get most-recent rate
CREATE OR REPLACE FUNCTION public.get_exchange_rate(
  _org uuid, _from text, _to text, _date date DEFAULT CURRENT_DATE
) RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN _from = _to THEN 1::numeric
    ELSE COALESCE(
      (SELECT rate FROM public.exchange_rates
        WHERE organization_id = _org AND from_currency = _from AND to_currency = _to AND effective_date <= _date
        ORDER BY effective_date DESC LIMIT 1),
      1::numeric
    )
  END;
$$;

-- 8. Trigger: audit exchange_rates
CREATE OR REPLACE FUNCTION public.log_exchange_rate_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    INSERT INTO public.exchange_rate_audit (organization_id, exchange_rate_id, from_currency, to_currency, effective_date, new_rate, action, source, performed_by)
    VALUES (NEW.organization_id, NEW.id, NEW.from_currency, NEW.to_currency, NEW.effective_date, NEW.rate, 'insert', NEW.source, auth.uid());
    RETURN NEW;
  ELSIF (TG_OP = 'UPDATE') THEN
    INSERT INTO public.exchange_rate_audit (organization_id, exchange_rate_id, from_currency, to_currency, effective_date, old_rate, new_rate, action, source, performed_by)
    VALUES (NEW.organization_id, NEW.id, NEW.from_currency, NEW.to_currency, NEW.effective_date, OLD.rate, NEW.rate, 'update', NEW.source, auth.uid());
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    INSERT INTO public.exchange_rate_audit (organization_id, exchange_rate_id, from_currency, to_currency, effective_date, old_rate, new_rate, action, source, performed_by)
    VALUES (OLD.organization_id, OLD.id, OLD.from_currency, OLD.to_currency, OLD.effective_date, OLD.rate, OLD.rate, 'delete', OLD.source, auth.uid());
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_log_exchange_rate_change ON public.exchange_rates;
CREATE TRIGGER trg_log_exchange_rate_change AFTER INSERT OR UPDATE OR DELETE ON public.exchange_rates
  FOR EACH ROW EXECUTE FUNCTION public.log_exchange_rate_change();

-- 9. Trigger: enforce period locks
CREATE OR REPLACE FUNCTION public.enforce_exchange_rate_lock()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _check_date date; _org uuid;
BEGIN
  IF (TG_OP = 'DELETE') THEN _check_date := OLD.effective_date; _org := OLD.organization_id;
  ELSE _check_date := NEW.effective_date; _org := NEW.organization_id; END IF;

  IF EXISTS (SELECT 1 FROM public.exchange_rate_locks
    WHERE organization_id = _org AND locked = true AND _check_date <= period_end) THEN
    RAISE EXCEPTION 'Exchange rate is within a locked period and cannot be modified';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;
DROP TRIGGER IF EXISTS trg_enforce_exchange_rate_lock ON public.exchange_rates;
CREATE TRIGGER trg_enforce_exchange_rate_lock BEFORE INSERT OR UPDATE OR DELETE ON public.exchange_rates
  FOR EACH ROW EXECUTE FUNCTION public.enforce_exchange_rate_lock();

-- 10. RLS
ALTER TABLE public.currency_revaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.currency_revaluation_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exchange_rate_locks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exchange_rate_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org members can view revaluations" ON public.currency_revaluations;
CREATE POLICY "org members can view revaluations" ON public.currency_revaluations
  FOR SELECT USING (public.is_org_member(auth.uid(), organization_id));
DROP POLICY IF EXISTS "org members can manage revaluations" ON public.currency_revaluations;
CREATE POLICY "org members can manage revaluations" ON public.currency_revaluations
  FOR ALL USING (public.is_org_member(auth.uid(), organization_id))
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));

DROP POLICY IF EXISTS "org members can view revaluation lines" ON public.currency_revaluation_lines;
CREATE POLICY "org members can view revaluation lines" ON public.currency_revaluation_lines
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.currency_revaluations cr
    WHERE cr.id = revaluation_id AND public.is_org_member(auth.uid(), cr.organization_id)));
DROP POLICY IF EXISTS "org members can manage revaluation lines" ON public.currency_revaluation_lines;
CREATE POLICY "org members can manage revaluation lines" ON public.currency_revaluation_lines
  FOR ALL USING (EXISTS (SELECT 1 FROM public.currency_revaluations cr
    WHERE cr.id = revaluation_id AND public.is_org_member(auth.uid(), cr.organization_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.currency_revaluations cr
    WHERE cr.id = revaluation_id AND public.is_org_member(auth.uid(), cr.organization_id)));

DROP POLICY IF EXISTS "org members can view locks" ON public.exchange_rate_locks;
CREATE POLICY "org members can view locks" ON public.exchange_rate_locks
  FOR SELECT USING (public.is_org_member(auth.uid(), organization_id));
DROP POLICY IF EXISTS "org members can manage locks" ON public.exchange_rate_locks;
CREATE POLICY "org members can manage locks" ON public.exchange_rate_locks
  FOR ALL USING (public.is_org_member(auth.uid(), organization_id))
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));

DROP POLICY IF EXISTS "org members can view rate audit" ON public.exchange_rate_audit;
CREATE POLICY "org members can view rate audit" ON public.exchange_rate_audit
  FOR SELECT USING (public.is_org_member(auth.uid(), organization_id));

-- 11. updated_at trigger
DROP TRIGGER IF EXISTS update_currency_revaluations_updated_at ON public.currency_revaluations;
CREATE TRIGGER update_currency_revaluations_updated_at
  BEFORE UPDATE ON public.currency_revaluations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();