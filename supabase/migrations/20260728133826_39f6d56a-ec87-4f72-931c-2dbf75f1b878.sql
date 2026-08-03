ALTER TABLE public.virtual_accounts
  ADD COLUMN IF NOT EXISTS balance numeric(18,2) NOT NULL DEFAULT 0;

CREATE TABLE public.virtual_account_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  virtual_account_id uuid NOT NULL REFERENCES public.virtual_accounts(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL,
  provider_tx_id text,
  type text NOT NULL CHECK (type IN ('credit','debit')),
  amount numeric(18,2) NOT NULL,
  currency text NOT NULL,
  status text NOT NULL DEFAULT 'successful',
  narration text,
  sender_name text,
  sender_bank text,
  sender_account text,
  raw_payload jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX virtual_account_tx_unique_provider
  ON public.virtual_account_transactions (virtual_account_id, provider_tx_id)
  WHERE provider_tx_id IS NOT NULL;

CREATE INDEX virtual_account_tx_org_idx
  ON public.virtual_account_transactions (organization_id, occurred_at DESC);

GRANT SELECT ON public.virtual_account_transactions TO authenticated;
GRANT ALL ON public.virtual_account_transactions TO service_role;

ALTER TABLE public.virtual_account_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vat_select_org_members"
  ON public.virtual_account_transactions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = virtual_account_transactions.organization_id
        AND om.user_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_virtual_account_tx_updated_at
  BEFORE UPDATE ON public.virtual_account_transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();