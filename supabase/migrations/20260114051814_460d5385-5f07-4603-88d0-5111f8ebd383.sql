-- Create integration_settings table to store configuration
CREATE TABLE public.integration_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  integration_name TEXT NOT NULL UNIQUE,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  settings JSONB DEFAULT '{}',
  last_tested_at TIMESTAMPTZ,
  connection_status TEXT DEFAULT 'unknown',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.integration_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can view/manage integration settings
CREATE POLICY "Only admins can view integration settings"
  ON public.integration_settings
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can insert integration settings"
  ON public.integration_settings
  FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can update integration settings"
  ON public.integration_settings
  FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER update_integration_settings_updated_at
  BEFORE UPDATE ON public.integration_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default integration records
INSERT INTO public.integration_settings (integration_name, is_enabled, connection_status) VALUES
  ('twilio', false, 'unknown'),
  ('stripe', false, 'unknown'),
  ('resend', false, 'unknown'),
  ('plaid', false, 'unknown')
ON CONFLICT (integration_name) DO NOTHING;