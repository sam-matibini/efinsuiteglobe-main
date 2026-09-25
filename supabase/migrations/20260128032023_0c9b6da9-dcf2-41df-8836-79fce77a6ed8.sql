-- Create enum for module types
CREATE TYPE public.module_type AS ENUM (
  'general_ledger',
  'accounts_payable',
  'accounts_receivable',
  'payroll',
  'banking',
  'fixed_assets',
  'budgeting',
  'practice_management',
  'donations',
  'inventory',
  'reporting'
);

-- Create modules reference table
CREATE TABLE public.modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code module_type NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  is_core BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create organization modules access table
CREATE TABLE public.organization_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
  is_enabled BOOLEAN DEFAULT true,
  enabled_at TIMESTAMPTZ DEFAULT now(),
  enabled_by UUID REFERENCES auth.users(id),
  disabled_at TIMESTAMPTZ,
  disabled_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, module_id)
);

-- Enable RLS
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_modules ENABLE ROW LEVEL SECURITY;

-- Modules are readable by all authenticated users
CREATE POLICY "Modules are viewable by authenticated users"
ON public.modules FOR SELECT TO authenticated
USING (true);

-- Only admins can manage modules
CREATE POLICY "Admins can manage modules"
ON public.modules FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Organization members can view their org's module access
CREATE POLICY "Org members can view their module access"
ON public.organization_modules FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = organization_modules.organization_id
    AND om.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin')
);

-- Only admins can manage organization module access
CREATE POLICY "Admins can manage organization module access"
ON public.organization_modules FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Insert default modules
INSERT INTO public.modules (code, name, description, icon, is_core, display_order) VALUES
  ('general_ledger', 'General Ledger', 'Chart of accounts, journal entries, and financial statements', 'BookOpen', true, 1),
  ('accounts_payable', 'Accounts Payable', 'Vendor management, bills, and payments', 'FileText', true, 2),
  ('accounts_receivable', 'Accounts Receivable', 'Customer management, invoices, and receipts', 'Receipt', true, 3),
  ('payroll', 'Payroll', 'Employee management, pay runs, and deductions', 'Users', false, 4),
  ('banking', 'Banking', 'Bank accounts, transactions, and reconciliation', 'Building', true, 5),
  ('fixed_assets', 'Fixed Assets', 'Asset tracking, depreciation, and disposal', 'Package', false, 6),
  ('budgeting', 'Budgeting', 'Budget creation, tracking, and variance analysis', 'TrendingUp', false, 7),
  ('practice_management', 'Practice Management', 'Client engagements, time tracking, and billing', 'Briefcase', false, 8),
  ('donations', 'Donations', 'Donor management, campaigns, and tax receipts', 'Heart', false, 9),
  ('inventory', 'Inventory', 'Stock management, tracking, and valuation', 'Warehouse', false, 10),
  ('reporting', 'Reporting', 'Financial reports and analytics', 'BarChart3', true, 11);

-- Create function to check if organization has module access
CREATE OR REPLACE FUNCTION public.has_module_access(p_organization_id UUID, p_module_code module_type)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.organization_modules om
    JOIN public.modules m ON m.id = om.module_id
    WHERE om.organization_id = p_organization_id
      AND m.code = p_module_code
      AND om.is_enabled = true
  )
$$;

-- Create function to initialize default modules for new organizations
CREATE OR REPLACE FUNCTION public.initialize_org_modules()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Add all core modules as enabled by default
  INSERT INTO public.organization_modules (organization_id, module_id, is_enabled, enabled_by)
  SELECT NEW.id, m.id, true, NEW.owner_id
  FROM public.modules m
  WHERE m.is_core = true;
  
  RETURN NEW;
END;
$$;

-- Create trigger to auto-initialize modules for new organizations
CREATE TRIGGER on_organization_created_init_modules
  AFTER INSERT ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.initialize_org_modules();

-- Create updated_at trigger
CREATE TRIGGER update_organization_modules_updated_at
  BEFORE UPDATE ON public.organization_modules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_pm_updated_at();