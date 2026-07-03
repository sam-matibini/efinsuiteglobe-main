-- ============================================================
-- RBAC Enhancement: Permissions, Role-Permissions, Audit Logs
-- ============================================================

-- 1. Permissions table - granular access controls
CREATE TABLE IF NOT EXISTS public.permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  permission_code VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  category VARCHAR(50) NOT NULL DEFAULT 'general',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Role Permissions mapping table
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_role VARCHAR(50) NOT NULL,  -- Links to organization_members.role
  permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(org_role, permission_id)
);

-- 3. Audit Logs table for compliance
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON public.role_permissions(org_role);
CREATE INDEX IF NOT EXISTS idx_audit_logs_org ON public.audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs(created_at DESC);

-- Enable RLS
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Permissions policies (read-only for authenticated users)
CREATE POLICY "Authenticated users can read permissions"
  ON public.permissions FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Only admins can manage permissions"
  ON public.permissions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Role Permissions policies (read-only for authenticated users)
CREATE POLICY "Authenticated users can read role_permissions"
  ON public.role_permissions FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Only admins can manage role_permissions"
  ON public.role_permissions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Audit logs policies
CREATE POLICY "Org members can view their org audit logs"
  ON public.audit_logs FOR SELECT TO authenticated
  USING (
    public.is_org_member(auth.uid(), organization_id) 
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "System can insert audit logs"
  ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (true);

-- ============================================================
-- Seed default permissions
-- ============================================================
INSERT INTO public.permissions (permission_code, description, category) VALUES
  -- General Ledger
  ('GL_READ', 'View chart of accounts and journal entries', 'general_ledger'),
  ('GL_POST', 'Create and post journal entries', 'general_ledger'),
  ('GL_VOID', 'Void or reverse journal entries', 'general_ledger'),
  
  -- Financial Reports
  ('FINANCIAL_REPORT_VIEW', 'View financial statements and reports', 'reports'),
  ('FINANCIAL_REPORT_EXPORT', 'Export financial reports', 'reports'),
  ('COMPILATION_CREATE', 'Create compilation reports', 'reports'),
  
  -- Budgets
  ('BUDGET_VIEW', 'View budgets and forecasts', 'budgets'),
  ('BUDGET_EDIT', 'Create and edit budgets', 'budgets'),
  ('BUDGET_APPROVE', 'Approve budget submissions', 'budgets'),
  
  -- Invoicing & AR
  ('INVOICE_VIEW', 'View invoices and receivables', 'receivables'),
  ('INVOICE_CREATE', 'Create and send invoices', 'receivables'),
  ('INVOICE_VOID', 'Void invoices', 'receivables'),
  ('PAYMENT_RECEIVE', 'Record customer payments', 'receivables'),
  
  -- Bills & AP
  ('BILL_VIEW', 'View bills and payables', 'payables'),
  ('BILL_CREATE', 'Create bills', 'payables'),
  ('BILL_APPROVE', 'Approve bills for payment', 'payables'),
  ('PAYMENT_MAKE', 'Make vendor payments', 'payables'),
  
  -- Banking
  ('BANK_VIEW', 'View bank accounts and transactions', 'banking'),
  ('BANK_RECONCILE', 'Perform bank reconciliation', 'banking'),
  ('BANK_TRANSFER', 'Execute fund transfers', 'banking'),
  
  -- Payroll
  ('PAYROLL_VIEW', 'View payroll information', 'payroll'),
  ('PAYROLL_PROCESS', 'Process payroll runs', 'payroll'),
  ('PAYROLL_APPROVE', 'Approve payroll for payment', 'payroll'),
  
  -- Fixed Assets
  ('ASSET_VIEW', 'View fixed assets', 'assets'),
  ('ASSET_MANAGE', 'Add/dispose fixed assets', 'assets'),
  ('DEPRECIATION_RUN', 'Run depreciation', 'assets'),
  
  -- User Management
  ('USER_VIEW', 'View team members', 'users'),
  ('USER_INVITE', 'Invite new users', 'users'),
  ('USER_MANAGE', 'Manage user roles and access', 'users'),
  
  -- Organization Settings
  ('SETTINGS_VIEW', 'View organization settings', 'settings'),
  ('SETTINGS_EDIT', 'Edit organization settings', 'settings'),
  
  -- Inventory
  ('INVENTORY_VIEW', 'View inventory items', 'inventory'),
  ('INVENTORY_MANAGE', 'Manage inventory', 'inventory'),
  
  -- Documents
  ('DOCUMENT_VIEW', 'View documents', 'documents'),
  ('DOCUMENT_UPLOAD', 'Upload documents', 'documents')
ON CONFLICT (permission_code) DO NOTHING;

-- ============================================================
-- Seed role-permission mappings
-- ============================================================

-- Owner has ALL permissions
INSERT INTO public.role_permissions (org_role, permission_id)
SELECT 'owner', id FROM public.permissions
ON CONFLICT DO NOTHING;

-- Admin has almost all permissions (except some owner-only)
INSERT INTO public.role_permissions (org_role, permission_id)
SELECT 'admin', id FROM public.permissions 
WHERE permission_code NOT IN ('USER_MANAGE')
ON CONFLICT DO NOTHING;

-- Finance Manager - full financial access
INSERT INTO public.role_permissions (org_role, permission_id)
SELECT 'finance_manager', id FROM public.permissions 
WHERE permission_code IN (
  'GL_READ', 'GL_POST', 'GL_VOID',
  'FINANCIAL_REPORT_VIEW', 'FINANCIAL_REPORT_EXPORT', 'COMPILATION_CREATE',
  'BUDGET_VIEW', 'BUDGET_EDIT', 'BUDGET_APPROVE',
  'INVOICE_VIEW', 'INVOICE_CREATE', 'INVOICE_VOID', 'PAYMENT_RECEIVE',
  'BILL_VIEW', 'BILL_CREATE', 'BILL_APPROVE', 'PAYMENT_MAKE',
  'BANK_VIEW', 'BANK_RECONCILE', 'BANK_TRANSFER',
  'PAYROLL_VIEW', 'PAYROLL_PROCESS', 'PAYROLL_APPROVE',
  'ASSET_VIEW', 'ASSET_MANAGE', 'DEPRECIATION_RUN',
  'USER_VIEW', 'USER_INVITE',
  'SETTINGS_VIEW',
  'INVENTORY_VIEW', 'INVENTORY_MANAGE',
  'DOCUMENT_VIEW', 'DOCUMENT_UPLOAD'
)
ON CONFLICT DO NOTHING;

-- Accountant - GL, reports, invoicing, bills
INSERT INTO public.role_permissions (org_role, permission_id)
SELECT 'accountant', id FROM public.permissions 
WHERE permission_code IN (
  'GL_READ', 'GL_POST',
  'FINANCIAL_REPORT_VIEW', 'FINANCIAL_REPORT_EXPORT', 'COMPILATION_CREATE',
  'BUDGET_VIEW',
  'INVOICE_VIEW', 'INVOICE_CREATE', 'PAYMENT_RECEIVE',
  'BILL_VIEW', 'BILL_CREATE',
  'BANK_VIEW', 'BANK_RECONCILE',
  'ASSET_VIEW', 'DEPRECIATION_RUN',
  'SETTINGS_VIEW',
  'INVENTORY_VIEW',
  'DOCUMENT_VIEW', 'DOCUMENT_UPLOAD'
)
ON CONFLICT DO NOTHING;

-- Payroll Officer - payroll focused
INSERT INTO public.role_permissions (org_role, permission_id)
SELECT 'payroll_officer', id FROM public.permissions 
WHERE permission_code IN (
  'GL_READ',
  'PAYROLL_VIEW', 'PAYROLL_PROCESS',
  'BANK_VIEW',
  'USER_VIEW',
  'DOCUMENT_VIEW', 'DOCUMENT_UPLOAD'
)
ON CONFLICT DO NOTHING;

-- Auditor - read-only access to everything
INSERT INTO public.role_permissions (org_role, permission_id)
SELECT 'auditor', id FROM public.permissions 
WHERE permission_code IN (
  'GL_READ',
  'FINANCIAL_REPORT_VIEW', 'FINANCIAL_REPORT_EXPORT',
  'BUDGET_VIEW',
  'INVOICE_VIEW',
  'BILL_VIEW',
  'BANK_VIEW',
  'PAYROLL_VIEW',
  'ASSET_VIEW',
  'USER_VIEW',
  'SETTINGS_VIEW',
  'INVENTORY_VIEW',
  'DOCUMENT_VIEW'
)
ON CONFLICT DO NOTHING;

-- Member - basic read access
INSERT INTO public.role_permissions (org_role, permission_id)
SELECT 'member', id FROM public.permissions 
WHERE permission_code IN (
  'GL_READ',
  'FINANCIAL_REPORT_VIEW',
  'INVOICE_VIEW',
  'BILL_VIEW',
  'DOCUMENT_VIEW'
)
ON CONFLICT DO NOTHING;

-- ============================================================
-- Permission checking function
-- ============================================================
CREATE OR REPLACE FUNCTION public.has_org_permission(
  p_user_id UUID,
  p_organization_id UUID,
  p_permission_code VARCHAR
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_has_permission BOOLEAN;
BEGIN
  -- Check if user is global admin first
  IF public.has_role(p_user_id, 'admin'::app_role) THEN
    RETURN TRUE;
  END IF;
  
  -- Get user's role in the organization
  SELECT role INTO v_role
  FROM organization_members
  WHERE user_id = p_user_id 
    AND organization_id = p_organization_id;
  
  IF v_role IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Owner has all permissions
  IF v_role = 'owner' THEN
    RETURN TRUE;
  END IF;
  
  -- Check role_permissions table
  SELECT EXISTS (
    SELECT 1 
    FROM role_permissions rp
    JOIN permissions p ON p.id = rp.permission_id
    WHERE rp.org_role = v_role
      AND p.permission_code = p_permission_code
  ) INTO v_has_permission;
  
  RETURN COALESCE(v_has_permission, FALSE);
END;
$$;

-- ============================================================
-- Get user permissions for an organization
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_user_org_permissions(
  p_user_id UUID,
  p_organization_id UUID
)
RETURNS TABLE(permission_code VARCHAR, description TEXT, category VARCHAR)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
BEGIN
  -- Check if user is global admin
  IF public.has_role(p_user_id, 'admin'::app_role) THEN
    RETURN QUERY SELECT p.permission_code, p.description, p.category FROM permissions p;
    RETURN;
  END IF;
  
  -- Get user's role
  SELECT role INTO v_role
  FROM organization_members
  WHERE user_id = p_user_id AND organization_id = p_organization_id;
  
  IF v_role IS NULL THEN
    RETURN;
  END IF;
  
  -- Owner gets all
  IF v_role = 'owner' THEN
    RETURN QUERY SELECT p.permission_code, p.description, p.category FROM permissions p;
    RETURN;
  END IF;
  
  -- Return role-specific permissions
  RETURN QUERY
  SELECT p.permission_code, p.description, p.category
  FROM permissions p
  JOIN role_permissions rp ON rp.permission_id = p.id
  WHERE rp.org_role = v_role;
END;
$$;

-- ============================================================
-- Audit log insertion function
-- ============================================================
CREATE OR REPLACE FUNCTION public.log_audit_event(
  p_organization_id UUID,
  p_action VARCHAR,
  p_entity_type VARCHAR DEFAULT NULL,
  p_entity_id UUID DEFAULT NULL,
  p_old_values JSONB DEFAULT NULL,
  p_new_values JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO audit_logs (
    user_id,
    organization_id,
    action,
    entity_type,
    entity_id,
    old_values,
    new_values
  ) VALUES (
    auth.uid(),
    p_organization_id,
    p_action,
    p_entity_type,
    p_entity_id,
    p_old_values,
    p_new_values
  )
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;

-- Add status column to profiles if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'status'
  ) THEN
    ALTER TABLE public.profiles 
    ADD COLUMN status VARCHAR(20) DEFAULT 'active' 
    CHECK (status IN ('invited', 'active', 'suspended'));
  END IF;
END $$;