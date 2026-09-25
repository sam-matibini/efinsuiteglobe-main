CREATE TABLE public.stripe_webhook_events (
  event_id text PRIMARY KEY,
  event_type text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  status text NOT NULL DEFAULT 'received',
  error text,
  payload jsonb
);

CREATE INDEX idx_stripe_webhook_events_received_at ON public.stripe_webhook_events (received_at DESC);
CREATE INDEX idx_stripe_webhook_events_status ON public.stripe_webhook_events (status);

GRANT SELECT ON public.stripe_webhook_events TO authenticated;
GRANT ALL ON public.stripe_webhook_events TO service_role;

ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view webhook events"
  ON public.stripe_webhook_events
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));