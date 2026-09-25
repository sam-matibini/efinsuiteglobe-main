
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS stripe_coupon_id text;

CREATE TABLE IF NOT EXISTS public.discount_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  percent numeric NOT NULL CHECK (percent > 0 AND percent <= 100),
  duration text NOT NULL CHECK (duration IN ('once','repeating','forever')),
  duration_in_months int,
  expires_at timestamptz,
  max_redemptions int,
  stripe_coupon_id text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'active',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.discount_presets TO authenticated;
GRANT ALL ON public.discount_presets TO service_role;

ALTER TABLE public.discount_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view discount presets"
  ON public.discount_presets FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_discount_presets_updated_at ON public.discount_presets;
CREATE TRIGGER update_discount_presets_updated_at
  BEFORE UPDATE ON public.discount_presets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
