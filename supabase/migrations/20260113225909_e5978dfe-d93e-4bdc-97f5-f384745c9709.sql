-- Create rate update logs table to track AI-driven rate updates
CREATE TABLE public.rate_update_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  country_id uuid REFERENCES public.countries(id),
  update_type text NOT NULL CHECK (update_type IN ('sales_tax', 'payroll', 'both')),
  effective_date date NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'applied', 'failed', 'scheduled')),
  changes_detected jsonb,
  changes_applied jsonb,
  ai_source text,
  ai_confidence numeric(3,2),
  triggered_by text CHECK (triggered_by IN ('scheduled', 'manual', 'date_change')),
  applied_at timestamptz,
  applied_by uuid,
  error_message text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.rate_update_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for rate update logs
CREATE POLICY "Users can view rate updates for their organization"
  ON public.rate_update_logs
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create rate updates for their organization"
  ON public.rate_update_logs
  FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update rate updates for their organization"
  ON public.rate_update_logs
  FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

-- Create scheduled rate updates table for calendar-based automatic updates
CREATE TABLE public.scheduled_rate_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_id uuid REFERENCES public.countries(id) NOT NULL,
  update_type text NOT NULL CHECK (update_type IN ('sales_tax', 'payroll')),
  effective_date date NOT NULL,
  rate_type_id uuid, -- Can reference tax_types or payroll_deduction_types
  old_value jsonb,
  new_value jsonb,
  source_url text,
  source_description text,
  is_verified boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(country_id, update_type, effective_date, rate_type_id)
);

-- Enable RLS
ALTER TABLE public.scheduled_rate_updates ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read scheduled updates (public rate info)
CREATE POLICY "Authenticated users can view scheduled rate updates"
  ON public.scheduled_rate_updates
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Add trigger for updated_at
CREATE TRIGGER update_rate_update_logs_updated_at
  BEFORE UPDATE ON public.rate_update_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_scheduled_rate_updates_updated_at
  BEFORE UPDATE ON public.scheduled_rate_updates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();