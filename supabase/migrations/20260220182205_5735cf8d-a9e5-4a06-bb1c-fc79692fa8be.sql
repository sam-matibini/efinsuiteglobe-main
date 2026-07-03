
-- ================================================================
-- Plaid integration hardening: schema + RLS improvements
-- ================================================================

-- 1. Add tracking columns to bank_accounts for Plaid sync state
ALTER TABLE public.bank_accounts
  ADD COLUMN IF NOT EXISTS plaid_last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS plaid_sync_status TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS plaid_sync_error TEXT DEFAULT NULL;

-- 2. Fix the INSERT RLS policy on bank_transactions to verify org membership
--    (previously used USING(true) which allowed any authenticated user to insert)
DROP POLICY IF EXISTS "Users can create transactions in their organization" ON public.bank_transactions;

CREATE POLICY "Users can create transactions in their organization"
  ON public.bank_transactions
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.bank_accounts ba
      WHERE ba.id = bank_transactions.bank_account_id
        AND is_org_member(auth.uid(), ba.organization_id)
    )
  );

-- 3. Fix the INSERT RLS policy on bank_accounts (was also USING(true))
DROP POLICY IF EXISTS "Users can create bank accounts in their organization" ON public.bank_accounts;

CREATE POLICY "Users can create bank accounts in their organization"
  ON public.bank_accounts
  FOR INSERT
  WITH CHECK (
    is_org_member(auth.uid(), organization_id)
  );

-- 4. Add index for efficient Plaid deduplication lookups
CREATE INDEX IF NOT EXISTS idx_bank_transactions_reference
  ON public.bank_transactions (bank_account_id, reference)
  WHERE reference IS NOT NULL;

-- 5. Add index for fast org-scoped transaction queries
CREATE INDEX IF NOT EXISTS idx_bank_transactions_date_account
  ON public.bank_transactions (bank_account_id, transaction_date DESC);
