ALTER TABLE public.bank_accounts
  ADD COLUMN IF NOT EXISTS stripe_bank_account_id text,
  ADD COLUMN IF NOT EXISTS stripe_processor_token_created_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_treasury_funding_default boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS bank_accounts_one_default_funding_per_org
  ON public.bank_accounts(organization_id)
  WHERE is_treasury_funding_default = true;