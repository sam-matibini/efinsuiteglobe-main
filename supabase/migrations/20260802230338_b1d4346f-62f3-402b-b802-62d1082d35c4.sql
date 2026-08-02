ALTER TABLE public.wise_webhook_events
  ADD COLUMN IF NOT EXISTS resource_type text,
  ADD COLUMN IF NOT EXISTS balance_id text,
  ADD COLUMN IF NOT EXISTS amount numeric,
  ADD COLUMN IF NOT EXISTS currency text,
  ADD COLUMN IF NOT EXISTS post_balance_amount numeric,
  ADD COLUMN IF NOT EXISTS transaction_type text,
  ADD COLUMN IF NOT EXISTS needs_attention boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS issue_summary text,
  ADD COLUMN IF NOT EXISTS active_cases jsonb;

CREATE INDEX IF NOT EXISTS idx_wise_webhook_events_balance_id ON public.wise_webhook_events (balance_id);
CREATE INDEX IF NOT EXISTS idx_wise_webhook_events_needs_attention ON public.wise_webhook_events (received_at DESC) WHERE needs_attention;