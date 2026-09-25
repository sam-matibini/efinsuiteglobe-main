
-- Nigerian rail flags on bank accounts
ALTER TABLE public.bank_accounts
  ADD COLUMN IF NOT EXISTS is_nibss_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_rtgs_enabled  boolean NOT NULL DEFAULT false;

-- RPC: mark a NG tax remittance as paid (called after treasury-pay-tax succeeds)
CREATE OR REPLACE FUNCTION public.ng_mark_remittance_paid(
  _remittance_id uuid,
  _confirmation_reference text DEFAULT NULL,
  _journal_entry_id uuid DEFAULT NULL,
  _bank_account_id uuid DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.ng_tax_remittances
  SET status = 'remitted',
      payment_date = COALESCE(payment_date, now()::date),
      confirmation_reference = COALESCE(_confirmation_reference, confirmation_reference),
      journal_entry_id = COALESCE(_journal_entry_id, journal_entry_id),
      bank_account_id = COALESCE(_bank_account_id, bank_account_id),
      updated_at = now()
  WHERE id = _remittance_id
    AND EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = ng_tax_remittances.organization_id
        AND om.user_id = auth.uid()
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.ng_mark_remittance_paid(uuid, text, uuid, uuid) TO authenticated;
