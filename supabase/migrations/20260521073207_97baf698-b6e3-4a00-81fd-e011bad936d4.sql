ALTER TABLE public.payment_links
  ADD COLUMN IF NOT EXISTS deposit_bank_account_id UUID REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS instant_payment BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS instant_method TEXT;

ALTER TABLE public.payment_links DROP CONSTRAINT IF EXISTS payment_links_instant_method_check;
ALTER TABLE public.payment_links
  ADD CONSTRAINT payment_links_instant_method_check
  CHECK (instant_method IS NULL OR instant_method IN ('interac_etransfer','card_instant_funding'));

CREATE INDEX IF NOT EXISTS idx_payment_links_deposit_bank ON public.payment_links(deposit_bank_account_id);