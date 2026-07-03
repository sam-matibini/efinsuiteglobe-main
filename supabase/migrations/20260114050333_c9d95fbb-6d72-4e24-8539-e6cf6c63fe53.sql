-- Create platform settings table for admin configuration
CREATE TABLE public.platform_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT NOT NULL UNIQUE,
  setting_value JSONB NOT NULL DEFAULT '{}',
  category TEXT NOT NULL DEFAULT 'general',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can read platform settings
CREATE POLICY "Admins can read platform settings"
ON public.platform_settings
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Only admins can insert platform settings
CREATE POLICY "Admins can insert platform settings"
ON public.platform_settings
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Only admins can update platform settings
CREATE POLICY "Admins can update platform settings"
ON public.platform_settings
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Only admins can delete platform settings
CREATE POLICY "Admins can delete platform settings"
ON public.platform_settings
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Add updated_at trigger
CREATE TRIGGER update_platform_settings_updated_at
BEFORE UPDATE ON public.platform_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default settings
INSERT INTO public.platform_settings (setting_key, setting_value, category) VALUES
  ('security', '{"require_email_verification": true, "two_factor_admin": false, "session_timeout_minutes": 30, "password_policy": "strong", "login_rate_limiting": true}', 'security'),
  ('branding', '{"platform_name": "EfinSuite", "support_email": "", "logo_url": "", "favicon_url": ""}', 'branding'),
  ('localization', '{"default_language": "en-US", "supported_jurisdictions": ["CA", "US", "KE", "ZM", "BI"], "supported_currencies": ["CAD", "USD", "KES", "ZMW", "BIF"]}', 'localization')
ON CONFLICT (setting_key) DO NOTHING;