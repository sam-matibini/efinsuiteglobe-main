CREATE TABLE public.efinsign_webhook_events (
  id text PRIMARY KEY,
  event text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.efinsign_webhook_events TO service_role;
ALTER TABLE public.efinsign_webhook_events ENABLE ROW LEVEL SECURITY;