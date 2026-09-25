
CREATE TABLE public.tax_provision_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  period_label TEXT NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  period_type TEXT NOT NULL DEFAULT 'annual' CHECK (period_type IN ('annual','interim','quarterly')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','review','final','filed')),
  reporting_framework TEXT NOT NULL DEFAULT 'asc740' CHECK (reporting_framework IN ('asc740','ias12','aspe3465')),
  pretax_book_income_cents BIGINT NOT NULL DEFAULT 0,
  current_tax_expense_cents BIGINT NOT NULL DEFAULT 0,
  deferred_tax_expense_cents BIGINT NOT NULL DEFAULT 0,
  total_tax_provision_cents BIGINT NOT NULL DEFAULT 0,
  effective_tax_rate NUMERIC(8,4) NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tax_provision_periods_org ON public.tax_provision_periods(organization_id, period_end DESC);
ALTER TABLE public.tax_provision_periods ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.tax_jurisdiction_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  jurisdiction_name TEXT NOT NULL,
  jurisdiction_type TEXT NOT NULL CHECK (jurisdiction_type IN ('federal','state','provincial','local','foreign')),
  country_code TEXT NOT NULL,
  region_code TEXT,
  statutory_rate NUMERIC(8,4) NOT NULL,
  effective_from DATE NOT NULL,
  effective_to DATE,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tax_jurisdiction_rates_org ON public.tax_jurisdiction_rates(organization_id, effective_from DESC);
ALTER TABLE public.tax_jurisdiction_rates ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.tax_temporary_differences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('depreciation','accruals','reserves','deferred_revenue','nol','tax_credit','intangibles','other')),
  difference_type TEXT NOT NULL CHECK (difference_type IN ('taxable','deductible')),
  gl_account_id UUID,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tax_temp_diff_org ON public.tax_temporary_differences(organization_id);
ALTER TABLE public.tax_temporary_differences ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.tax_temp_diff_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  provision_period_id UUID NOT NULL REFERENCES public.tax_provision_periods(id) ON DELETE CASCADE,
  temp_diff_id UUID NOT NULL REFERENCES public.tax_temporary_differences(id) ON DELETE CASCADE,
  opening_balance_cents BIGINT NOT NULL DEFAULT 0,
  originating_cents BIGINT NOT NULL DEFAULT 0,
  reversing_cents BIGINT NOT NULL DEFAULT 0,
  closing_balance_cents BIGINT NOT NULL DEFAULT 0,
  applied_rate NUMERIC(8,4) NOT NULL DEFAULT 0,
  deferred_tax_balance_cents BIGINT NOT NULL DEFAULT 0,
  deferred_tax_movement_cents BIGINT NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tax_temp_diff_mov_period ON public.tax_temp_diff_movements(provision_period_id);
ALTER TABLE public.tax_temp_diff_movements ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.tax_provision_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  provision_period_id UUID NOT NULL REFERENCES public.tax_provision_periods(id) ON DELETE CASCADE,
  adjustment_type TEXT NOT NULL CHECK (adjustment_type IN ('permanent_difference','discrete_item','tax_credit','prior_year_adjustment','rate_change')),
  description TEXT NOT NULL,
  amount_cents BIGINT NOT NULL DEFAULT 0,
  tax_impact_cents BIGINT NOT NULL DEFAULT 0,
  applied_rate NUMERIC(8,4),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tax_provision_adj_period ON public.tax_provision_adjustments(provision_period_id);
ALTER TABLE public.tax_provision_adjustments ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.tax_nol_carryforwards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  origin_year INTEGER NOT NULL,
  origin_jurisdiction TEXT NOT NULL,
  original_amount_cents BIGINT NOT NULL,
  utilized_amount_cents BIGINT NOT NULL DEFAULT 0,
  remaining_amount_cents BIGINT NOT NULL,
  expiry_date DATE,
  is_indefinite BOOLEAN NOT NULL DEFAULT false,
  valuation_allowance_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tax_nol_org ON public.tax_nol_carryforwards(organization_id, origin_year);
ALTER TABLE public.tax_nol_carryforwards ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.tax_etr_reconciliation_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  provision_period_id UUID NOT NULL REFERENCES public.tax_provision_periods(id) ON DELETE CASCADE,
  line_order INTEGER NOT NULL DEFAULT 0,
  description TEXT NOT NULL,
  amount_cents BIGINT NOT NULL DEFAULT 0,
  rate_pct NUMERIC(8,4) NOT NULL DEFAULT 0,
  line_type TEXT NOT NULL DEFAULT 'item' CHECK (line_type IN ('statutory','item','subtotal','effective')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tax_etr_recon_period ON public.tax_etr_reconciliation_lines(provision_period_id, line_order);
ALTER TABLE public.tax_etr_reconciliation_lines ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t TEXT;
  tbls TEXT[] := ARRAY[
    'tax_provision_periods',
    'tax_jurisdiction_rates',
    'tax_temporary_differences',
    'tax_temp_diff_movements',
    'tax_provision_adjustments',
    'tax_nol_carryforwards',
    'tax_etr_reconciliation_lines'
  ];
BEGIN
  FOREACH t IN ARRAY tbls LOOP
    EXECUTE format('CREATE POLICY "%1$s_select" ON public.%1$I FOR SELECT USING (public.is_org_member(auth.uid(), organization_id))', t);
    EXECUTE format('CREATE POLICY "%1$s_insert" ON public.%1$I FOR INSERT WITH CHECK (public.is_org_member(auth.uid(), organization_id))', t);
    EXECUTE format('CREATE POLICY "%1$s_update" ON public.%1$I FOR UPDATE USING (public.is_org_member(auth.uid(), organization_id)) WITH CHECK (public.is_org_member(auth.uid(), organization_id))', t);
    EXECUTE format('CREATE POLICY "%1$s_delete" ON public.%1$I FOR DELETE USING (public.is_org_member(auth.uid(), organization_id))', t);
  END LOOP;
END$$;

CREATE TRIGGER trg_tax_provision_periods_updated BEFORE UPDATE ON public.tax_provision_periods FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_tax_jurisdiction_rates_updated BEFORE UPDATE ON public.tax_jurisdiction_rates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_tax_temp_diff_updated BEFORE UPDATE ON public.tax_temporary_differences FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_tax_temp_diff_mov_updated BEFORE UPDATE ON public.tax_temp_diff_movements FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_tax_provision_adj_updated BEFORE UPDATE ON public.tax_provision_adjustments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_tax_nol_updated BEFORE UPDATE ON public.tax_nol_carryforwards FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
