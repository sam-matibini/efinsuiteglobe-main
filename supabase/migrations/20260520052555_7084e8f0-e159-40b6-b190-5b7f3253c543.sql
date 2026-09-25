ALTER TABLE public.bank_accounts
  ADD COLUMN IF NOT EXISTS institution_type text NOT NULL DEFAULT 'bank',
  ADD COLUMN IF NOT EXISTS institution_code text;

ALTER TABLE public.bank_accounts
  DROP CONSTRAINT IF EXISTS bank_accounts_institution_type_check;

ALTER TABLE public.bank_accounts
  ADD CONSTRAINT bank_accounts_institution_type_check
  CHECK (institution_type IN ('bank','mobile_money','ewallet','microfinance','other'));

UPDATE public.bank_accounts SET institution_type = 'bank' WHERE institution_type IS NULL;