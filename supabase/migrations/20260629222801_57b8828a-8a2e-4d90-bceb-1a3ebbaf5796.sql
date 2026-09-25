
ALTER TABLE public.settlement_matches
  ADD COLUMN IF NOT EXISTS journal_entry_id uuid REFERENCES public.journal_entries(id) ON DELETE SET NULL;

ALTER TABLE public.processor_accounts
  ADD COLUMN IF NOT EXISTS fees_gl_account_id uuid REFERENCES public.accounts(id),
  ADD COLUMN IF NOT EXISTS clearing_gl_account_id uuid REFERENCES public.accounts(id),
  ADD COLUMN IF NOT EXISTS chargebacks_gl_account_id uuid REFERENCES public.accounts(id);

CREATE INDEX IF NOT EXISTS idx_settlement_matches_je ON public.settlement_matches(journal_entry_id);

-- Backfill bank_account_id from processor's expected bank account
UPDATE public.settlements s
SET bank_account_id = pa.expected_bank_account_id
FROM public.processor_accounts pa
WHERE s.processor_account_id = pa.id
  AND s.bank_account_id IS NULL
  AND pa.expected_bank_account_id IS NOT NULL;
