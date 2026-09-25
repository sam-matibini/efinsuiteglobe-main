ALTER TABLE public.credit_cards
  ADD COLUMN IF NOT EXISTS plaid_access_token text,
  ADD COLUMN IF NOT EXISTS plaid_account_id text,
  ADD COLUMN IF NOT EXISTS plaid_item_id text,
  ADD COLUMN IF NOT EXISTS plaid_last_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS plaid_sync_status text,
  ADD COLUMN IF NOT EXISTS plaid_sync_error text,
  ADD COLUMN IF NOT EXISTS routing_number text,
  ADD COLUMN IF NOT EXISTS ach_verified_at timestamptz;