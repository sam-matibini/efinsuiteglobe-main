-- Extend tax_payments with rail + lifecycle tracking for CRA Remittance Centre
ALTER TABLE public.tax_payments
  ADD COLUMN IF NOT EXISTS payment_rail text,
  ADD COLUMN IF NOT EXISTS rail_payment_id text,
  ADD COLUMN IF NOT EXISTS settlement_reference text,
  ADD COLUMN IF NOT EXISTS settled_at timestamptz,
  ADD COLUMN IF NOT EXISTS scheduled_payment_id uuid REFERENCES public.scheduled_payments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS requires_mfa boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS card_brand text,
  ADD COLUMN IF NOT EXISTS card_last4 text,
  ADD COLUMN IF NOT EXISTS filing_period_label text;

-- Rail check (nullable; null = manual/unspecified)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tax_payments_payment_rail_check'
  ) THEN
    ALTER TABLE public.tax_payments
      ADD CONSTRAINT tax_payments_payment_rail_check
      CHECK (payment_rail IS NULL OR payment_rail IN ('manual','stripe_card','vopay_eft','vopay_pad','vopay_instant','cra_my_payment','wire','cheque'));
  END IF;
END$$;

-- Relax status check to support the full 8-state lifecycle
ALTER TABLE public.tax_payments DROP CONSTRAINT IF EXISTS tax_payments_status_check;
ALTER TABLE public.tax_payments
  ADD CONSTRAINT tax_payments_status_check
  CHECK (status IN (
    'draft','pending','authorized','processing','completed','returned',
    -- legacy values, kept for backwards compatibility
    'scheduled','submitted','paid','failed','reversed','cancelled'
  ));

CREATE INDEX IF NOT EXISTS idx_tax_payments_rail
  ON public.tax_payments(organization_id, payment_rail);
CREATE INDEX IF NOT EXISTS idx_tax_payments_schedule
  ON public.tax_payments(organization_id, scheduled_payment_id);
CREATE INDEX IF NOT EXISTS idx_tax_payments_cra_account
  ON public.tax_payments(organization_id, cra_account_id);

COMMENT ON COLUMN public.tax_payments.payment_rail IS 'Phase 2+ payment rail. Null = legacy/manual.';
COMMENT ON COLUMN public.tax_payments.requires_mfa IS 'Force MFA re-challenge before submitting to rail.';