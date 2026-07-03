
CREATE TABLE IF NOT EXISTS public.stripe_payout_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  connected_account_id uuid REFERENCES public.stripe_connected_accounts(id) ON DELETE CASCADE,
  stripe_payout_id text NOT NULL,
  arrival_date date,
  gross_amount numeric(18,2) NOT NULL DEFAULT 0,
  fees numeric(18,2) NOT NULL DEFAULT 0,
  net_amount numeric(18,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  status text NOT NULL DEFAULT 'pending',
  destination_bank_account_id uuid REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
  journal_entry_id uuid,
  reconciled_at timestamptz,
  bank_transaction_id uuid,
  raw jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (connected_account_id, stripe_payout_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stripe_payout_ledger TO authenticated;
GRANT ALL ON public.stripe_payout_ledger TO service_role;
ALTER TABLE public.stripe_payout_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members manage payout ledger" ON public.stripe_payout_ledger FOR ALL
USING (public.is_org_member(auth.uid(), org_id)) WITH CHECK (public.is_org_member(auth.uid(), org_id));
CREATE INDEX IF NOT EXISTS idx_spl_org_arr ON public.stripe_payout_ledger(org_id, arrival_date DESC);
CREATE INDEX IF NOT EXISTS idx_spl_recon ON public.stripe_payout_ledger(org_id) WHERE reconciled_at IS NULL;
CREATE TRIGGER update_spl_updated_at BEFORE UPDATE ON public.stripe_payout_ledger
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.stripe_balance_transaction_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  connected_account_id uuid REFERENCES public.stripe_connected_accounts(id) ON DELETE CASCADE,
  stripe_bt_id text NOT NULL,
  type text,
  amount numeric(18,2),
  fee numeric(18,2),
  net numeric(18,2),
  currency text,
  available_on date,
  created_on timestamptz,
  source text,
  raw jsonb DEFAULT '{}'::jsonb,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (connected_account_id, stripe_bt_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stripe_balance_transaction_cache TO authenticated;
GRANT ALL ON public.stripe_balance_transaction_cache TO service_role;
ALTER TABLE public.stripe_balance_transaction_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members manage bt cache" ON public.stripe_balance_transaction_cache FOR ALL
USING (public.is_org_member(auth.uid(), org_id)) WITH CHECK (public.is_org_member(auth.uid(), org_id));
CREATE INDEX IF NOT EXISTS idx_sbtc_unprocessed ON public.stripe_balance_transaction_cache(org_id) WHERE processed_at IS NULL;
