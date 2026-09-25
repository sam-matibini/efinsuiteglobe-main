CREATE TABLE public.wise_webhook_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type text NOT NULL,
  subscription_id text,
  delivery_id text,
  transfer_id text,
  profile_id text,
  current_state text,
  previous_state text,
  occurred_at timestamptz,
  signature_valid boolean NOT NULL DEFAULT false,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  received_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_wise_webhook_events_delivery_id ON public.wise_webhook_events (delivery_id) WHERE delivery_id IS NOT NULL;
CREATE INDEX idx_wise_webhook_events_transfer_id ON public.wise_webhook_events (transfer_id);
CREATE INDEX idx_wise_webhook_events_received_at ON public.wise_webhook_events (received_at DESC);

GRANT SELECT ON public.wise_webhook_events TO authenticated;
GRANT ALL ON public.wise_webhook_events TO service_role;

ALTER TABLE public.wise_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view wise webhook events"
  ON public.wise_webhook_events
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));