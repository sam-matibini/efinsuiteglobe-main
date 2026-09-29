
CREATE TABLE public.platform_staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  level text NOT NULL DEFAULT 'owner',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.platform_staff TO authenticated;
GRANT ALL ON public.platform_staff TO service_role;
ALTER TABLE public.platform_staff ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_platform_staff()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.platform_staff WHERE user_id = auth.uid())
$$;
REVOKE EXECUTE ON FUNCTION public.is_platform_staff() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_platform_staff() TO authenticated, service_role;

CREATE POLICY "staff read staff" ON public.platform_staff FOR SELECT TO authenticated USING (public.is_platform_staff());

INSERT INTO public.platform_staff (user_id, email, level)
VALUES ('d9b1f840-e1e0-4fd9-9194-3502adda28c1', 'smatibini.sm@gmail.com', 'owner')
ON CONFLICT (user_id) DO NOTHING;

CREATE TABLE public.plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  blurb text,
  price_amount numeric,
  price_currency text NOT NULL DEFAULT 'CAD',
  price_unit text NOT NULL DEFAULT 'per verification',
  included_volume integer NOT NULL DEFAULT 0,
  overage_amount numeric,
  features text[] NOT NULL DEFAULT '{}',
  featured boolean NOT NULL DEFAULT false,
  public_visible boolean NOT NULL DEFAULT true,
  custom_pricing boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.plans TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plans TO authenticated;
GRANT ALL ON public.plans TO service_role;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon reads visible plans" ON public.plans FOR SELECT TO anon USING (public_visible);
CREATE POLICY "users read plans" ON public.plans FOR SELECT TO authenticated USING (public_visible OR public.is_platform_staff());
CREATE POLICY "staff write plans" ON public.plans FOR INSERT TO authenticated WITH CHECK (public.is_platform_staff());
CREATE POLICY "staff update plans" ON public.plans FOR UPDATE TO authenticated USING (public.is_platform_staff());
CREATE POLICY "staff delete plans" ON public.plans FOR DELETE TO authenticated USING (public.is_platform_staff());
CREATE TRIGGER plans_touch BEFORE UPDATE ON public.plans FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.org_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.plans(id),
  price_override numeric,
  included_volume_override integer,
  status text NOT NULL DEFAULT 'trial',
  notes text,
  started_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_subscriptions TO authenticated;
GRANT ALL ON public.org_subscriptions TO service_role;
ALTER TABLE public.org_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own or staff" ON public.org_subscriptions FOR SELECT TO authenticated USING (public.is_platform_staff() OR public.is_org_member(org_id));
CREATE POLICY "staff insert subs" ON public.org_subscriptions FOR INSERT TO authenticated WITH CHECK (public.is_platform_staff());
CREATE POLICY "staff update subs" ON public.org_subscriptions FOR UPDATE TO authenticated USING (public.is_platform_staff());
CREATE POLICY "staff delete subs" ON public.org_subscriptions FOR DELETE TO authenticated USING (public.is_platform_staff());
CREATE TRIGGER org_subscriptions_touch BEFORE UPDATE ON public.org_subscriptions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.usage_counters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  period text NOT NULL,
  verifications integer NOT NULL DEFAULT 0,
  screenings integer NOT NULL DEFAULT 0,
  transactions integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, period)
);
GRANT SELECT ON public.usage_counters TO authenticated;
GRANT ALL ON public.usage_counters TO service_role;
ALTER TABLE public.usage_counters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read usage" ON public.usage_counters FOR SELECT TO authenticated USING (public.is_platform_staff() OR public.is_org_member(org_id));

CREATE OR REPLACE FUNCTION public.bump_usage(_org uuid, _kind text, _amount integer DEFAULT 1)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare p text := to_char(now(), 'YYYY-MM');
begin
  insert into public.usage_counters (org_id, period, verifications, screenings, transactions)
  values (_org, p,
    case when _kind = 'verification' then _amount else 0 end,
    case when _kind = 'screening' then _amount else 0 end,
    case when _kind = 'transaction' then _amount else 0 end)
  on conflict (org_id, period) do update set
    verifications = public.usage_counters.verifications + case when _kind = 'verification' then _amount else 0 end,
    screenings = public.usage_counters.screenings + case when _kind = 'screening' then _amount else 0 end,
    transactions = public.usage_counters.transactions + case when _kind = 'transaction' then _amount else 0 end,
    updated_at = now();
end;
$$;
REVOKE EXECUTE ON FUNCTION public.bump_usage(uuid, text, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.bump_usage(uuid, text, integer) TO authenticated, service_role;

CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  number text NOT NULL UNIQUE,
  period text NOT NULL,
  currency text NOT NULL DEFAULT 'CAD',
  subtotal numeric NOT NULL DEFAULT 0,
  tax_rate numeric NOT NULL DEFAULT 0,
  tax_amount numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  issued_at timestamptz,
  due_at timestamptz,
  paid_at timestamptz,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read invoices" ON public.invoices FOR SELECT TO authenticated USING (public.is_platform_staff() OR public.is_org_member(org_id));
CREATE POLICY "staff insert invoices" ON public.invoices FOR INSERT TO authenticated WITH CHECK (public.is_platform_staff());
CREATE POLICY "staff update invoices" ON public.invoices FOR UPDATE TO authenticated USING (public.is_platform_staff());
CREATE TRIGGER invoices_touch BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.invoice_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  unit_amount numeric NOT NULL DEFAULT 0,
  amount numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_lines TO authenticated;
GRANT ALL ON public.invoice_lines TO service_role;
ALTER TABLE public.invoice_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read invoice lines" ON public.invoice_lines FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id AND (public.is_platform_staff() OR public.is_org_member(i.org_id))));
CREATE POLICY "staff write invoice lines" ON public.invoice_lines FOR INSERT TO authenticated WITH CHECK (public.is_platform_staff());
CREATE POLICY "staff update invoice lines" ON public.invoice_lines FOR UPDATE TO authenticated USING (public.is_platform_staff());
CREATE POLICY "staff delete invoice lines" ON public.invoice_lines FOR DELETE TO authenticated USING (public.is_platform_staff());

CREATE TABLE public.app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton boolean NOT NULL DEFAULT true UNIQUE,
  legal_name text,
  trading_name text,
  address_line1 text,
  address_line2 text,
  city text,
  region text,
  postal_code text,
  country text,
  contact_email text,
  support_email text,
  billing_email text,
  phone text,
  registration_number text,
  tax_number text,
  tax_rate numeric NOT NULL DEFAULT 0,
  invoice_footer text,
  email_from_name text,
  email_from_address text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.app_settings TO anon;
GRANT SELECT, INSERT, UPDATE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone reads settings" ON public.app_settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "staff insert settings" ON public.app_settings FOR INSERT TO authenticated WITH CHECK (public.is_platform_staff());
CREATE POLICY "staff update settings" ON public.app_settings FOR UPDATE TO authenticated USING (public.is_platform_staff());
CREATE TRIGGER app_settings_touch BEFORE UPDATE ON public.app_settings FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
INSERT INTO public.app_settings (singleton) VALUES (true) ON CONFLICT DO NOTHING;

CREATE TABLE public.integration_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL UNIQUE,
  label text NOT NULL,
  category text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'not_configured',
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_checked_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.integration_settings TO authenticated;
GRANT ALL ON public.integration_settings TO service_role;
ALTER TABLE public.integration_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read integrations" ON public.integration_settings FOR SELECT TO authenticated USING (public.is_platform_staff());
CREATE POLICY "staff insert integrations" ON public.integration_settings FOR INSERT TO authenticated WITH CHECK (public.is_platform_staff());
CREATE POLICY "staff update integrations" ON public.integration_settings FOR UPDATE TO authenticated USING (public.is_platform_staff());
CREATE TRIGGER integration_settings_touch BEFORE UPDATE ON public.integration_settings FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.integration_settings (provider, label, category) VALUES
  ('resend', 'Resend', 'email'),
  ('plaid', 'Plaid', 'bank'),
  ('interac', 'Interac verification', 'bank'),
  ('telesign', 'Telesign', 'phone'),
  ('ipqs', 'IP and email risk', 'risk')
ON CONFLICT (provider) DO NOTHING;

CREATE TABLE public.notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  event text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, event)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read prefs" ON public.notification_preferences FOR SELECT TO authenticated USING (public.is_platform_staff() OR public.is_org_member(org_id));
CREATE POLICY "admins insert prefs" ON public.notification_preferences FOR INSERT TO authenticated WITH CHECK (public.has_org_role(org_id, 'admin'));
CREATE POLICY "admins update prefs" ON public.notification_preferences FOR UPDATE TO authenticated USING (public.has_org_role(org_id, 'admin'));
CREATE POLICY "admins delete prefs" ON public.notification_preferences FOR DELETE TO authenticated USING (public.has_org_role(org_id, 'admin'));

CREATE TABLE public.email_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  event text NOT NULL,
  recipient text NOT NULL,
  subject text NOT NULL,
  status text NOT NULL,
  provider text NOT NULL DEFAULT 'resend',
  provider_id text,
  error_detail text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.email_log TO authenticated;
GRANT ALL ON public.email_log TO service_role;
ALTER TABLE public.email_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read email log" ON public.email_log FOR SELECT TO authenticated USING (public.is_platform_staff() OR public.is_org_member(org_id));
