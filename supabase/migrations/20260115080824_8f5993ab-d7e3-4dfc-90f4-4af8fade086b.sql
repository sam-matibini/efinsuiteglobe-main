-- Consolidation Groups table
CREATE TABLE public.consolidation_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  consolidation_type TEXT NOT NULL DEFAULT 'domestic' CHECK (consolidation_type IN ('domestic', 'international')),
  base_currency TEXT NOT NULL DEFAULT 'USD',
  parent_organization_id UUID REFERENCES public.organizations(id),
  fiscal_year_end_month INTEGER DEFAULT 12,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Consolidation Group Members
CREATE TABLE public.consolidation_group_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.consolidation_groups(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  ownership_percentage NUMERIC(5,2) NOT NULL DEFAULT 100.00,
  consolidation_method TEXT NOT NULL DEFAULT 'full' CHECK (consolidation_method IN ('full', 'proportional', 'equity')),
  functional_currency TEXT NOT NULL,
  is_parent BOOLEAN NOT NULL DEFAULT false,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(group_id, organization_id)
);

-- Intercompany Accounts Mapping
CREATE TABLE public.intercompany_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.consolidation_groups(id) ON DELETE CASCADE,
  from_organization_id UUID NOT NULL REFERENCES public.organizations(id),
  to_organization_id UUID NOT NULL REFERENCES public.organizations(id),
  from_account_id UUID REFERENCES public.accounts(id),
  to_account_id UUID REFERENCES public.accounts(id),
  account_type TEXT NOT NULL CHECK (account_type IN ('receivable', 'payable', 'investment', 'equity', 'revenue', 'expense')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Consolidation Reports
CREATE TABLE public.consolidation_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.consolidation_groups(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL CHECK (report_type IN ('balance_sheet', 'income_statement', 'cash_flow', 'changes_in_equity')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  base_currency TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'final', 'archived')),
  report_data JSONB,
  elimination_entries JSONB,
  currency_translations JSONB,
  notes TEXT,
  generated_by UUID,
  generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  finalized_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Exchange Rates for Consolidation
CREATE TABLE public.consolidation_exchange_rates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.consolidation_groups(id) ON DELETE CASCADE,
  from_currency TEXT NOT NULL,
  to_currency TEXT NOT NULL,
  rate_date DATE NOT NULL,
  spot_rate NUMERIC(18,8) NOT NULL,
  average_rate NUMERIC(18,8),
  closing_rate NUMERIC(18,8),
  source TEXT DEFAULT 'manual',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(group_id, from_currency, to_currency, rate_date)
);

-- Enable RLS
ALTER TABLE public.consolidation_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consolidation_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intercompany_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consolidation_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consolidation_exchange_rates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for consolidation_groups
CREATE POLICY "Users can view consolidation groups they have access to"
ON public.consolidation_groups FOR SELECT
USING (
  parent_organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Users can manage consolidation groups for their organizations"
ON public.consolidation_groups FOR ALL
USING (
  parent_organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin')
);

-- RLS Policies for consolidation_group_members
CREATE POLICY "Users can view group members"
ON public.consolidation_group_members FOR SELECT
USING (
  group_id IN (
    SELECT id FROM public.consolidation_groups WHERE parent_organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  )
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Users can manage group members"
ON public.consolidation_group_members FOR ALL
USING (
  group_id IN (
    SELECT id FROM public.consolidation_groups WHERE parent_organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  )
  OR public.has_role(auth.uid(), 'admin')
);

-- RLS Policies for intercompany_accounts
CREATE POLICY "Users can view intercompany accounts"
ON public.intercompany_accounts FOR SELECT
USING (
  group_id IN (
    SELECT id FROM public.consolidation_groups WHERE parent_organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  )
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Users can manage intercompany accounts"
ON public.intercompany_accounts FOR ALL
USING (
  group_id IN (
    SELECT id FROM public.consolidation_groups WHERE parent_organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  )
  OR public.has_role(auth.uid(), 'admin')
);

-- RLS Policies for consolidation_reports
CREATE POLICY "Users can view consolidation reports"
ON public.consolidation_reports FOR SELECT
USING (
  group_id IN (
    SELECT id FROM public.consolidation_groups WHERE parent_organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  )
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Users can manage consolidation reports"
ON public.consolidation_reports FOR ALL
USING (
  group_id IN (
    SELECT id FROM public.consolidation_groups WHERE parent_organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  )
  OR public.has_role(auth.uid(), 'admin')
);

-- RLS Policies for exchange rates
CREATE POLICY "Users can view exchange rates"
ON public.consolidation_exchange_rates FOR SELECT
USING (
  group_id IN (
    SELECT id FROM public.consolidation_groups WHERE parent_organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  )
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Users can manage exchange rates"
ON public.consolidation_exchange_rates FOR ALL
USING (
  group_id IN (
    SELECT id FROM public.consolidation_groups WHERE parent_organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  )
  OR public.has_role(auth.uid(), 'admin')
);

-- Triggers for updated_at
CREATE TRIGGER update_consolidation_groups_updated_at
  BEFORE UPDATE ON public.consolidation_groups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_consolidation_group_members_updated_at
  BEFORE UPDATE ON public.consolidation_group_members
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();