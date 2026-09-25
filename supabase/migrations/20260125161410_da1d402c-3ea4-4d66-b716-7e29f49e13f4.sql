-- Practice Management Module - Phase 1 MVP Schema

-- Enum types for practice management
CREATE TYPE public.client_risk_rating AS ENUM ('low', 'medium', 'high');
CREATE TYPE public.client_status AS ENUM ('draft', 'active', 'inactive', 'archived');
CREATE TYPE public.engagement_status AS ENUM ('draft', 'active', 'on_hold', 'completed', 'cancelled');
CREATE TYPE public.billing_type AS ENUM ('fixed', 'hourly', 'retainer', 'hybrid');
CREATE TYPE public.task_priority AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE public.task_status AS ENUM ('pending', 'in_progress', 'review', 'completed', 'cancelled');
CREATE TYPE public.time_entry_status AS ENUM ('draft', 'submitted', 'approved', 'billed');
CREATE TYPE public.pm_invoice_status AS ENUM ('draft', 'sent', 'paid', 'overdue', 'cancelled');

-- Clients table (accounting firm's clients)
CREATE TABLE public.pm_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  legal_name TEXT NOT NULL,
  trading_name TEXT,
  country TEXT NOT NULL DEFAULT 'CA',
  tax_id TEXT,
  industry TEXT,
  client_type TEXT DEFAULT 'corporate', -- corporate, individual, npo, trust
  risk_rating public.client_risk_rating DEFAULT 'low',
  status public.client_status DEFAULT 'draft',
  primary_contact_name TEXT,
  primary_contact_email TEXT,
  primary_contact_phone TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  province TEXT,
  postal_code TEXT,
  notes TEXT,
  kyc_verified_at TIMESTAMPTZ,
  aml_verified_at TIMESTAMPTZ,
  onboarded_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Client to Organization mapping (for multi-org clients)
CREATE TABLE public.pm_client_organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.pm_clients(id) ON DELETE CASCADE NOT NULL,
  linked_org_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  relationship_type TEXT DEFAULT 'primary', -- primary, subsidiary, related
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Service catalog (reusable service templates)
CREATE TABLE public.pm_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT, -- audit, tax, bookkeeping, payroll, advisory
  country TEXT DEFAULT 'CA',
  default_billing_type public.billing_type DEFAULT 'hourly',
  default_rate NUMERIC(10,2),
  estimated_hours NUMERIC(10,2),
  sla_days INTEGER,
  is_recurring BOOLEAN DEFAULT false,
  recurrence_pattern TEXT, -- monthly, quarterly, annually
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Engagements (client service agreements)
CREATE TABLE public.pm_engagements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  client_id UUID REFERENCES public.pm_clients(id) ON DELETE CASCADE NOT NULL,
  service_id UUID REFERENCES public.pm_services(id) ON DELETE SET NULL,
  engagement_number TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  service_type TEXT NOT NULL, -- audit, tax_corporate, tax_personal, bookkeeping, payroll, advisory
  fiscal_year INTEGER,
  start_date DATE NOT NULL,
  end_date DATE,
  billing_type public.billing_type DEFAULT 'hourly',
  fixed_fee NUMERIC(12,2),
  hourly_rate NUMERIC(10,2),
  retainer_amount NUMERIC(12,2),
  budget_hours NUMERIC(10,2),
  status public.engagement_status DEFAULT 'draft',
  partner_id UUID REFERENCES auth.users(id),
  manager_id UUID REFERENCES auth.users(id),
  engagement_letter_url TEXT,
  engagement_letter_signed_at TIMESTAMPTZ,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, engagement_number)
);

-- Task templates (for workflow automation)
CREATE TABLE public.pm_task_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  service_id UUID REFERENCES public.pm_services(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  estimated_hours NUMERIC(10,2),
  priority public.task_priority DEFAULT 'medium',
  order_index INTEGER DEFAULT 0,
  dependency_template_id UUID REFERENCES public.pm_task_templates(id),
  country TEXT DEFAULT 'CA',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tasks (actual work items)
CREATE TABLE public.pm_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  engagement_id UUID REFERENCES public.pm_engagements(id) ON DELETE CASCADE NOT NULL,
  template_id UUID REFERENCES public.pm_task_templates(id),
  name TEXT NOT NULL,
  description TEXT,
  assigned_to UUID REFERENCES auth.users(id),
  due_date DATE,
  priority public.task_priority DEFAULT 'medium',
  status public.task_status DEFAULT 'pending',
  estimated_hours NUMERIC(10,2),
  actual_hours NUMERIC(10,2) DEFAULT 0,
  dependency_task_id UUID REFERENCES public.pm_tasks(id),
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Time entries
CREATE TABLE public.pm_time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  engagement_id UUID REFERENCES public.pm_engagements(id) ON DELETE CASCADE NOT NULL,
  task_id UUID REFERENCES public.pm_tasks(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  entry_date DATE NOT NULL,
  hours NUMERIC(10,2) NOT NULL,
  description TEXT,
  is_billable BOOLEAN DEFAULT true,
  billing_rate NUMERIC(10,2),
  status public.time_entry_status DEFAULT 'draft',
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  invoice_id UUID,
  timer_started_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Practice management invoices
CREATE TABLE public.pm_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  client_id UUID REFERENCES public.pm_clients(id) ON DELETE CASCADE NOT NULL,
  engagement_id UUID REFERENCES public.pm_engagements(id) ON DELETE SET NULL,
  invoice_number TEXT NOT NULL,
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL,
  period_start DATE,
  period_end DATE,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(12,2) DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  amount_paid NUMERIC(12,2) DEFAULT 0,
  balance_due NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency TEXT DEFAULT 'CAD',
  status public.pm_invoice_status DEFAULT 'draft',
  notes TEXT,
  sent_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, invoice_number)
);

-- Invoice line items
CREATE TABLE public.pm_invoice_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES public.pm_invoices(id) ON DELETE CASCADE NOT NULL,
  time_entry_id UUID REFERENCES public.pm_time_entries(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  quantity NUMERIC(10,2) DEFAULT 1,
  rate NUMERIC(10,2) NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  line_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Compliance deadlines
CREATE TABLE public.pm_compliance_deadlines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  client_id UUID REFERENCES public.pm_clients(id) ON DELETE CASCADE NOT NULL,
  engagement_id UUID REFERENCES public.pm_engagements(id) ON DELETE SET NULL,
  filing_type TEXT NOT NULL, -- T2, HST, 1120, VAT, etc.
  country TEXT NOT NULL DEFAULT 'CA',
  jurisdiction TEXT,
  fiscal_year INTEGER,
  due_date DATE NOT NULL,
  extended_due_date DATE,
  filed_at TIMESTAMPTZ,
  confirmation_number TEXT,
  status TEXT DEFAULT 'pending', -- pending, filed, late, extended
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- AI insights log
CREATE TABLE public.pm_ai_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  insight_type TEXT NOT NULL, -- late_filing_risk, underbilling, staff_reallocation, low_margin
  entity_type TEXT, -- client, engagement, task, user
  entity_id UUID,
  title TEXT NOT NULL,
  description TEXT,
  severity TEXT DEFAULT 'info', -- info, warning, critical
  recommended_action TEXT,
  is_dismissed BOOLEAN DEFAULT false,
  dismissed_by UUID REFERENCES auth.users(id),
  dismissed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.pm_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pm_client_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pm_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pm_engagements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pm_task_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pm_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pm_time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pm_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pm_invoice_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pm_compliance_deadlines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pm_ai_insights ENABLE ROW LEVEL SECURITY;

-- RLS Policies for pm_clients
CREATE POLICY "Users can view clients in their org" ON public.pm_clients
  FOR SELECT USING (
    organization_id IN (
      SELECT om.organization_id FROM public.organization_members om WHERE om.user_id = auth.uid()
    ) OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Users can insert clients in their org" ON public.pm_clients
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT om.organization_id FROM public.organization_members om WHERE om.user_id = auth.uid()
    ) OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Users can update clients in their org" ON public.pm_clients
  FOR UPDATE USING (
    organization_id IN (
      SELECT om.organization_id FROM public.organization_members om WHERE om.user_id = auth.uid()
    ) OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Users can delete clients in their org" ON public.pm_clients
  FOR DELETE USING (
    organization_id IN (
      SELECT om.organization_id FROM public.organization_members om WHERE om.user_id = auth.uid()
    ) OR public.has_role(auth.uid(), 'admin')
  );

-- RLS Policies for pm_client_organizations
CREATE POLICY "Users can manage client orgs" ON public.pm_client_organizations
  FOR ALL USING (
    client_id IN (
      SELECT c.id FROM public.pm_clients c 
      WHERE c.organization_id IN (
        SELECT om.organization_id FROM public.organization_members om WHERE om.user_id = auth.uid()
      )
    ) OR public.has_role(auth.uid(), 'admin')
  );

-- RLS Policies for pm_services
CREATE POLICY "Users can manage services in their org" ON public.pm_services
  FOR ALL USING (
    organization_id IN (
      SELECT om.organization_id FROM public.organization_members om WHERE om.user_id = auth.uid()
    ) OR public.has_role(auth.uid(), 'admin')
  );

-- RLS Policies for pm_engagements
CREATE POLICY "Users can manage engagements in their org" ON public.pm_engagements
  FOR ALL USING (
    organization_id IN (
      SELECT om.organization_id FROM public.organization_members om WHERE om.user_id = auth.uid()
    ) OR public.has_role(auth.uid(), 'admin')
  );

-- RLS Policies for pm_task_templates
CREATE POLICY "Users can manage task templates in their org" ON public.pm_task_templates
  FOR ALL USING (
    organization_id IN (
      SELECT om.organization_id FROM public.organization_members om WHERE om.user_id = auth.uid()
    ) OR public.has_role(auth.uid(), 'admin')
  );

-- RLS Policies for pm_tasks
CREATE POLICY "Users can manage tasks in their org" ON public.pm_tasks
  FOR ALL USING (
    organization_id IN (
      SELECT om.organization_id FROM public.organization_members om WHERE om.user_id = auth.uid()
    ) OR public.has_role(auth.uid(), 'admin')
  );

-- RLS Policies for pm_time_entries
CREATE POLICY "Users can manage time entries in their org" ON public.pm_time_entries
  FOR ALL USING (
    organization_id IN (
      SELECT om.organization_id FROM public.organization_members om WHERE om.user_id = auth.uid()
    ) OR public.has_role(auth.uid(), 'admin')
  );

-- RLS Policies for pm_invoices
CREATE POLICY "Users can manage invoices in their org" ON public.pm_invoices
  FOR ALL USING (
    organization_id IN (
      SELECT om.organization_id FROM public.organization_members om WHERE om.user_id = auth.uid()
    ) OR public.has_role(auth.uid(), 'admin')
  );

-- RLS Policies for pm_invoice_lines
CREATE POLICY "Users can manage invoice lines" ON public.pm_invoice_lines
  FOR ALL USING (
    invoice_id IN (
      SELECT i.id FROM public.pm_invoices i
      WHERE i.organization_id IN (
        SELECT om.organization_id FROM public.organization_members om WHERE om.user_id = auth.uid()
      )
    ) OR public.has_role(auth.uid(), 'admin')
  );

-- RLS Policies for pm_compliance_deadlines
CREATE POLICY "Users can manage compliance deadlines in their org" ON public.pm_compliance_deadlines
  FOR ALL USING (
    organization_id IN (
      SELECT om.organization_id FROM public.organization_members om WHERE om.user_id = auth.uid()
    ) OR public.has_role(auth.uid(), 'admin')
  );

-- RLS Policies for pm_ai_insights
CREATE POLICY "Users can manage AI insights in their org" ON public.pm_ai_insights
  FOR ALL USING (
    organization_id IN (
      SELECT om.organization_id FROM public.organization_members om WHERE om.user_id = auth.uid()
    ) OR public.has_role(auth.uid(), 'admin')
  );

-- Indexes for performance
CREATE INDEX idx_pm_clients_org ON public.pm_clients(organization_id);
CREATE INDEX idx_pm_clients_status ON public.pm_clients(status);
CREATE INDEX idx_pm_engagements_org ON public.pm_engagements(organization_id);
CREATE INDEX idx_pm_engagements_client ON public.pm_engagements(client_id);
CREATE INDEX idx_pm_engagements_status ON public.pm_engagements(status);
CREATE INDEX idx_pm_tasks_engagement ON public.pm_tasks(engagement_id);
CREATE INDEX idx_pm_tasks_assigned ON public.pm_tasks(assigned_to);
CREATE INDEX idx_pm_tasks_status ON public.pm_tasks(status);
CREATE INDEX idx_pm_tasks_due ON public.pm_tasks(due_date);
CREATE INDEX idx_pm_time_entries_engagement ON public.pm_time_entries(engagement_id);
CREATE INDEX idx_pm_time_entries_user ON public.pm_time_entries(user_id);
CREATE INDEX idx_pm_time_entries_date ON public.pm_time_entries(entry_date);
CREATE INDEX idx_pm_compliance_due ON public.pm_compliance_deadlines(due_date);
CREATE INDEX idx_pm_compliance_client ON public.pm_compliance_deadlines(client_id);

-- Trigger to update timestamps
CREATE OR REPLACE FUNCTION public.update_pm_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_pm_clients_updated_at BEFORE UPDATE ON public.pm_clients FOR EACH ROW EXECUTE FUNCTION public.update_pm_updated_at();
CREATE TRIGGER update_pm_services_updated_at BEFORE UPDATE ON public.pm_services FOR EACH ROW EXECUTE FUNCTION public.update_pm_updated_at();
CREATE TRIGGER update_pm_engagements_updated_at BEFORE UPDATE ON public.pm_engagements FOR EACH ROW EXECUTE FUNCTION public.update_pm_updated_at();
CREATE TRIGGER update_pm_tasks_updated_at BEFORE UPDATE ON public.pm_tasks FOR EACH ROW EXECUTE FUNCTION public.update_pm_updated_at();
CREATE TRIGGER update_pm_time_entries_updated_at BEFORE UPDATE ON public.pm_time_entries FOR EACH ROW EXECUTE FUNCTION public.update_pm_updated_at();
CREATE TRIGGER update_pm_invoices_updated_at BEFORE UPDATE ON public.pm_invoices FOR EACH ROW EXECUTE FUNCTION public.update_pm_updated_at();
CREATE TRIGGER update_pm_compliance_updated_at BEFORE UPDATE ON public.pm_compliance_deadlines FOR EACH ROW EXECUTE FUNCTION public.update_pm_updated_at();