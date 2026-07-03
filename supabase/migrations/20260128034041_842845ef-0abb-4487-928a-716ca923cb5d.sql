-- ==========================================
-- PM ENGAGEMENT STAFF / TEAM MEMBERS TABLE
-- ==========================================

-- Create staff role type for engagement team
CREATE TYPE public.pm_staff_role AS ENUM (
  'partner',
  'manager', 
  'senior',
  'staff',
  'intern',
  'contractor'
);

-- Create engagement staff table to manage team members on engagements
CREATE TABLE public.pm_engagement_staff (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  engagement_id UUID NOT NULL REFERENCES public.pm_engagements(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  staff_name TEXT NOT NULL,
  staff_email TEXT,
  role pm_staff_role NOT NULL DEFAULT 'staff',
  billing_rate NUMERIC(10,2),
  budgeted_hours NUMERIC(10,2),
  actual_hours NUMERIC(10,2) DEFAULT 0,
  start_date DATE,
  end_date DATE,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Prevent duplicate staff on same engagement
  UNIQUE(engagement_id, user_id)
);

-- Enable RLS
ALTER TABLE public.pm_engagement_staff ENABLE ROW LEVEL SECURITY;

-- RLS Policies for pm_engagement_staff
CREATE POLICY "Users can view staff in their organization" 
  ON public.pm_engagement_staff 
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = pm_engagement_staff.organization_id
      AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage staff in their organization" 
  ON public.pm_engagement_staff 
  FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = pm_engagement_staff.organization_id
      AND om.user_id = auth.uid()
    )
  );

-- Index for performance
CREATE INDEX idx_pm_engagement_staff_org ON public.pm_engagement_staff(organization_id);
CREATE INDEX idx_pm_engagement_staff_engagement ON public.pm_engagement_staff(engagement_id);
CREATE INDEX idx_pm_engagement_staff_user ON public.pm_engagement_staff(user_id);

-- Trigger for updated_at
CREATE TRIGGER update_pm_engagement_staff_updated_at
  BEFORE UPDATE ON public.pm_engagement_staff
  FOR EACH ROW
  EXECUTE FUNCTION public.update_pm_updated_at();

-- ==========================================
-- ADD COUNTRY FIELD TO PM_ENGAGEMENTS IF MISSING
-- ==========================================
ALTER TABLE public.pm_engagements 
  ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'CA';

-- ==========================================
-- ADD LOCALIZATION FIELDS TO PM_SERVICES
-- ==========================================
ALTER TABLE public.pm_services
  ADD COLUMN IF NOT EXISTS jurisdiction TEXT;