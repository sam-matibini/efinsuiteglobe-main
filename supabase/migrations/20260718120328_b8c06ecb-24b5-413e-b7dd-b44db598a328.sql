
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS discount_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS trial_extended_by uuid,
  ADD COLUMN IF NOT EXISTS trial_extended_at timestamptz;

INSERT INTO public.platform_settings (setting_key, setting_value, category)
VALUES
  ('subscription.trial_period_days', '{"days": 14}'::jsonb, 'subscription'),
  ('subscription.global_discount', '{"percent": 0, "expires_at": null, "stripe_coupon_id": null, "note": null}'::jsonb, 'subscription')
ON CONFLICT (setting_key) DO NOTHING;
