-- ================================================================
-- FIXED ASSETS REGISTER - COMPREHENSIVE ENHANCEMENT
-- ================================================================

-- 1. Add extended fields to fixed_assets table
ALTER TABLE public.fixed_assets 
ADD COLUMN IF NOT EXISTS barcode TEXT,
ADD COLUMN IF NOT EXISTS qr_code TEXT,
ADD COLUMN IF NOT EXISTS location_id UUID,
ADD COLUMN IF NOT EXISTS department_id UUID,
ADD COLUMN IF NOT EXISTS cost_center TEXT,
ADD COLUMN IF NOT EXISTS custodian_id UUID,
ADD COLUMN IF NOT EXISTS invoice_number TEXT,
ADD COLUMN IF NOT EXISTS warranty_expiry_date DATE,
ADD COLUMN IF NOT EXISTS insurance_policy_ref TEXT,
ADD COLUMN IF NOT EXISTS insurance_expiry_date DATE,
ADD COLUMN IF NOT EXISTS asset_condition TEXT DEFAULT 'good',
ADD COLUMN IF NOT EXISTS ownership_status TEXT DEFAULT 'owned',
ADD COLUMN IF NOT EXISTS funding_source TEXT,
ADD COLUMN IF NOT EXISTS capitalization_threshold NUMERIC(15,2) DEFAULT 500,
ADD COLUMN IF NOT EXISTS cca_class TEXT,
ADD COLUMN IF NOT EXISTS cca_rate NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS tax_depreciation_method TEXT,
ADD COLUMN IF NOT EXISTS tax_accumulated_depreciation NUMERIC(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS tax_book_value NUMERIC(15,2),
ADD COLUMN IF NOT EXISTS last_revaluation_date DATE,
ADD COLUMN IF NOT EXISTS revaluation_amount NUMERIC(15,2),
ADD COLUMN IF NOT EXISTS impairment_amount NUMERIC(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_idle BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS idle_since DATE,
ADD COLUMN IF NOT EXISTS ai_classification_confidence NUMERIC(3,2),
ADD COLUMN IF NOT EXISTS ai_suggested_class TEXT,
ADD COLUMN IF NOT EXISTS ai_suggested_useful_life INTEGER;

-- 2. Create CCA Classes table for Canadian tax depreciation
CREATE TABLE IF NOT EXISTS public.cca_classes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id),
  class_number TEXT NOT NULL,
  description TEXT,
  rate NUMERIC(5,2) NOT NULL,
  method TEXT DEFAULT 'declining_balance',
  half_year_rule BOOLEAN DEFAULT true,
  recapture_eligible BOOLEAN DEFAULT true,
  terminal_loss_eligible BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on cca_classes
ALTER TABLE public.cca_classes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view CCA classes in their org" 
ON public.cca_classes FOR SELECT 
USING (organization_id IS NULL OR is_org_member(auth.uid(), organization_id));

CREATE POLICY "Users can create CCA classes in their org" 
ON public.cca_classes FOR INSERT 
WITH CHECK (is_org_member(auth.uid(), organization_id));

CREATE POLICY "Users can update CCA classes in their org" 
ON public.cca_classes FOR UPDATE 
USING (is_org_member(auth.uid(), organization_id));

CREATE POLICY "Users can delete CCA classes in their org" 
ON public.cca_classes FOR DELETE 
USING (is_org_member(auth.uid(), organization_id));

-- 3. Create Asset Movement/Transfer History table
CREATE TABLE IF NOT EXISTS public.asset_movements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_id UUID NOT NULL REFERENCES public.fixed_assets(id) ON DELETE CASCADE,
  movement_type TEXT NOT NULL, -- 'transfer', 'location_change', 'department_change', 'custodian_change'
  movement_date DATE NOT NULL DEFAULT CURRENT_DATE,
  from_location TEXT,
  to_location TEXT,
  from_department TEXT,
  to_department TEXT,
  from_custodian TEXT,
  to_custodian TEXT,
  reason TEXT,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.asset_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view asset movements in their org" 
ON public.asset_movements FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM fixed_assets a 
  WHERE a.id = asset_movements.asset_id 
  AND is_org_member(auth.uid(), a.organization_id)
));

CREATE POLICY "Users can create asset movements in their org" 
ON public.asset_movements FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM fixed_assets a 
  WHERE a.id = asset_movements.asset_id 
  AND is_org_member(auth.uid(), a.organization_id)
));

-- 4. Create Asset Audit Trail table
CREATE TABLE IF NOT EXISTS public.asset_audit_trail (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_id UUID NOT NULL REFERENCES public.fixed_assets(id) ON DELETE CASCADE,
  action TEXT NOT NULL, -- 'created', 'updated', 'depreciated', 'revalued', 'impaired', 'disposed', 'transferred'
  field_changed TEXT,
  old_value TEXT,
  new_value TEXT,
  performed_by UUID,
  performed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address TEXT,
  user_agent TEXT,
  details JSONB
);

ALTER TABLE public.asset_audit_trail ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view asset audit trail in their org" 
ON public.asset_audit_trail FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM fixed_assets a 
  WHERE a.id = asset_audit_trail.asset_id 
  AND is_org_member(auth.uid(), a.organization_id)
));

CREATE POLICY "Users can create asset audit entries in their org" 
ON public.asset_audit_trail FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM fixed_assets a 
  WHERE a.id = asset_audit_trail.asset_id 
  AND is_org_member(auth.uid(), a.organization_id)
));

-- 5. Create Asset Disposals table for detailed disposal tracking
CREATE TABLE IF NOT EXISTS public.asset_disposals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_id UUID NOT NULL REFERENCES public.fixed_assets(id),
  disposal_type TEXT NOT NULL, -- 'sale', 'scrap', 'donation', 'write_off', 'trade_in'
  disposal_date DATE NOT NULL,
  proceeds NUMERIC(15,2) DEFAULT 0,
  costs_of_disposal NUMERIC(15,2) DEFAULT 0,
  net_proceeds NUMERIC(15,2) DEFAULT 0,
  book_value_at_disposal NUMERIC(15,2) NOT NULL,
  accumulated_dep_at_disposal NUMERIC(15,2) NOT NULL,
  gain_loss NUMERIC(15,2) NOT NULL,
  final_depreciation_amount NUMERIC(15,2) DEFAULT 0,
  buyer_name TEXT,
  buyer_reference TEXT,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  journal_entry_id UUID REFERENCES public.journal_entries(id),
  depreciation_journal_entry_id UUID REFERENCES public.journal_entries(id),
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.asset_disposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view asset disposals in their org" 
ON public.asset_disposals FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM fixed_assets a 
  WHERE a.id = asset_disposals.asset_id 
  AND is_org_member(auth.uid(), a.organization_id)
));

CREATE POLICY "Users can create asset disposals in their org" 
ON public.asset_disposals FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM fixed_assets a 
  WHERE a.id = asset_disposals.asset_id 
  AND is_org_member(auth.uid(), a.organization_id)
));

CREATE POLICY "Users can update asset disposals in their org" 
ON public.asset_disposals FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM fixed_assets a 
  WHERE a.id = asset_disposals.asset_id 
  AND is_org_member(auth.uid(), a.organization_id)
));

-- 6. Create Asset Revaluations table
CREATE TABLE IF NOT EXISTS public.asset_revaluations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_id UUID NOT NULL REFERENCES public.fixed_assets(id) ON DELETE CASCADE,
  revaluation_type TEXT NOT NULL, -- 'upward', 'downward', 'impairment', 'impairment_reversal'
  revaluation_date DATE NOT NULL,
  old_book_value NUMERIC(15,2) NOT NULL,
  new_book_value NUMERIC(15,2) NOT NULL,
  adjustment_amount NUMERIC(15,2) NOT NULL,
  appraiser_name TEXT,
  appraiser_reference TEXT,
  journal_entry_id UUID REFERENCES public.journal_entries(id),
  notes TEXT,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.asset_revaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view asset revaluations in their org" 
ON public.asset_revaluations FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM fixed_assets a 
  WHERE a.id = asset_revaluations.asset_id 
  AND is_org_member(auth.uid(), a.organization_id)
));

CREATE POLICY "Users can create asset revaluations in their org" 
ON public.asset_revaluations FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM fixed_assets a 
  WHERE a.id = asset_revaluations.asset_id 
  AND is_org_member(auth.uid(), a.organization_id)
));

-- 7. Add GL account mappings to fixed_asset_categories
ALTER TABLE public.fixed_asset_categories
ADD COLUMN IF NOT EXISTS gain_loss_account_id UUID REFERENCES public.accounts(id),
ADD COLUMN IF NOT EXISTS default_cca_class TEXT,
ADD COLUMN IF NOT EXISTS default_cca_rate NUMERIC(5,2);

-- 8. Insert default Canadian CCA classes
INSERT INTO public.cca_classes (organization_id, class_number, description, rate, method, half_year_rule)
VALUES 
  (NULL, '1', 'Buildings acquired after 1987', 4.00, 'declining_balance', true),
  (NULL, '3', 'Buildings acquired before 1988', 5.00, 'declining_balance', true),
  (NULL, '6', 'Fences, greenhouses', 10.00, 'declining_balance', true),
  (NULL, '8', 'Furniture, fixtures, equipment', 20.00, 'declining_balance', true),
  (NULL, '10', 'Motor vehicles, general purpose equipment', 30.00, 'declining_balance', true),
  (NULL, '10.1', 'Passenger vehicles over $30,000', 30.00, 'declining_balance', true),
  (NULL, '12', 'Tools, medical instruments, software', 100.00, 'declining_balance', true),
  (NULL, '13', 'Leasehold improvements', 0.00, 'straight_line', false),
  (NULL, '14', 'Patents, franchises, licences', 0.00, 'straight_line', false),
  (NULL, '14.1', 'Goodwill', 5.00, 'declining_balance', true),
  (NULL, '17', 'Parking lots, roads', 8.00, 'declining_balance', true),
  (NULL, '43', 'Manufacturing equipment (enhanced)', 30.00, 'declining_balance', true),
  (NULL, '44', 'Patents after April 1993', 25.00, 'declining_balance', true),
  (NULL, '45', 'Computer equipment (acquired before 2022)', 45.00, 'declining_balance', true),
  (NULL, '50', 'Computer equipment (acquired after 2022)', 55.00, 'declining_balance', true),
  (NULL, '53', 'Manufacturing equipment (2016-2025)', 50.00, 'declining_balance', true),
  (NULL, '54', 'Zero-emission vehicles', 30.00, 'declining_balance', true),
  (NULL, '55', 'Zero-emission vehicles (enhanced)', 100.00, 'declining_balance', true)
ON CONFLICT DO NOTHING;

-- 9. Create index for performance
CREATE INDEX IF NOT EXISTS idx_fixed_assets_status ON public.fixed_assets(status);
CREATE INDEX IF NOT EXISTS idx_fixed_assets_category ON public.fixed_assets(category_id);
CREATE INDEX IF NOT EXISTS idx_fixed_assets_cca_class ON public.fixed_assets(cca_class);
CREATE INDEX IF NOT EXISTS idx_asset_movements_asset ON public.asset_movements(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_audit_trail_asset ON public.asset_audit_trail(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_disposals_asset ON public.asset_disposals(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_revaluations_asset ON public.asset_revaluations(asset_id);