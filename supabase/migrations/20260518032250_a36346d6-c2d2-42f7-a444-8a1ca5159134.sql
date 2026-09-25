ALTER TABLE public.bank_transactions
  ADD COLUMN IF NOT EXISTS tax_code_id uuid REFERENCES public.tax_codes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tax_amount numeric(18,2),
  ADD COLUMN IF NOT EXISTS tax_breakdown jsonb,
  ADD COLUMN IF NOT EXISTS subtotal_amount numeric(18,2);

ALTER TABLE public.credit_card_transactions
  ADD COLUMN IF NOT EXISTS tax_code_id uuid REFERENCES public.tax_codes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tax_amount numeric(18,2),
  ADD COLUMN IF NOT EXISTS tax_breakdown jsonb,
  ADD COLUMN IF NOT EXISTS subtotal_amount numeric(18,2);

CREATE INDEX IF NOT EXISTS idx_bank_transactions_tax_code ON public.bank_transactions(tax_code_id) WHERE tax_code_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cc_transactions_tax_code ON public.credit_card_transactions(tax_code_id) WHERE tax_code_id IS NOT NULL;