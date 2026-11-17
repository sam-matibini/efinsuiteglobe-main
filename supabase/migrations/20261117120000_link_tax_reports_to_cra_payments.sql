-- Link final tax reports to CRA Payments.
--
-- A PD7A remittance (public.remittances) or a GST/HST return (public.tax_returns) can be
-- paid through CRA Payments (public.tax_payments, CRA My Payment workflow). This migration:
--   1. adds tax_payments.tax_return_id (remittance_id already exists),
--   2. allows only one live CRA payment per report,
--   3. marks the report paid once its CRA payment is confirmed (never at hand-off),
--   4. lets an unpaid PD7A be deleted, but not one that is paid or has a CRA payment in progress.

-- ---------------------------------------------------------------------------
-- 1. Link column
-- ---------------------------------------------------------------------------
ALTER TABLE public.tax_payments
  ADD COLUMN IF NOT EXISTS tax_return_id uuid REFERENCES public.tax_returns(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_tax_payments_tax_return ON public.tax_payments(tax_return_id);

-- ---------------------------------------------------------------------------
-- 2. One live CRA payment per report (cancelled payments do not count)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cra_one_payment_per_report()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF coalesce(NEW.workflow_status, NEW.status) = 'cancelled' THEN
    RETURN NEW;
  END IF;
  IF NEW.remittance_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.tax_payments p
    WHERE p.remittance_id = NEW.remittance_id AND p.id <> NEW.id
      AND coalesce(p.workflow_status, p.status) <> 'cancelled'
  ) THEN
    RAISE EXCEPTION 'This PD7A remittance already has a CRA payment. Open it in CRA Payments instead.';
  END IF;
  IF NEW.tax_return_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.tax_payments p
    WHERE p.tax_return_id = NEW.tax_return_id AND p.id <> NEW.id
      AND coalesce(p.workflow_status, p.status) <> 'cancelled'
  ) THEN
    RAISE EXCEPTION 'This GST/HST return already has a CRA payment. Open it in CRA Payments instead.';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_cra_one_payment_per_report ON public.tax_payments;
CREATE TRIGGER trg_cra_one_payment_per_report
  BEFORE INSERT OR UPDATE OF remittance_id, tax_return_id, workflow_status, status ON public.tax_payments
  FOR EACH ROW EXECUTE FUNCTION public.cra_one_payment_per_report();

-- ---------------------------------------------------------------------------
-- 3. Mark the report paid when CRA confirms the payment
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cra_mark_tax_report_paid()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.workflow_status IN ('payment_completed','reconciliation_pending','reconciled')
     AND (TG_OP = 'INSERT' OR OLD.workflow_status IS NULL
          OR OLD.workflow_status NOT IN ('payment_completed','reconciliation_pending','reconciled')) THEN
    IF NEW.remittance_id IS NOT NULL THEN
      UPDATE public.remittances
         SET status = 'paid',
             paid_date = coalesce(NEW.paid_at::date, current_date),
             confirmation_number = coalesce(NEW.confirmation_number, confirmation_number)
       WHERE id = NEW.remittance_id
         AND organization_id = NEW.organization_id
         AND coalesce(status, '') <> 'paid';
    END IF;
    IF NEW.tax_return_id IS NOT NULL THEN
      UPDATE public.tax_returns
         SET status = 'paid',
             paid_at = coalesce(NEW.paid_at, now()),
             payment_reference = coalesce(NEW.confirmation_number, payment_reference)
       WHERE id = NEW.tax_return_id
         AND organization_id = NEW.organization_id
         AND status <> 'paid';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_cra_mark_tax_report_paid ON public.tax_payments;
CREATE TRIGGER trg_cra_mark_tax_report_paid
  AFTER INSERT OR UPDATE OF workflow_status ON public.tax_payments
  FOR EACH ROW EXECUTE FUNCTION public.cra_mark_tax_report_paid();

-- ---------------------------------------------------------------------------
-- 4. Deleting a PD7A remittance
--    Allowed while it is unpaid and any linked CRA payment is still a draft (the draft
--    is removed with it). Blocked once it is paid or a CRA payment is under way, because
--    from that point the payment and its journal entry depend on it.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_remittance_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ref text;
BEGIN
  IF OLD.status = 'paid' THEN
    RAISE EXCEPTION 'A paid remittance cannot be deleted. It is kept for the audit trail.';
  END IF;
  SELECT reference INTO v_ref FROM public.tax_payments
   WHERE remittance_id = OLD.id
     AND coalesce(workflow_status, status) NOT IN ('draft','cancelled')
   LIMIT 1;
  IF v_ref IS NOT NULL THEN
    RAISE EXCEPTION 'CRA payment % is under way for this remittance. Cancel it in CRA Payments before deleting.', v_ref;
  END IF;
  DELETE FROM public.tax_payments
   WHERE remittance_id = OLD.id AND workflow_status = 'draft';
  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS trg_guard_remittance_delete ON public.remittances;
CREATE TRIGGER trg_guard_remittance_delete
  BEFORE DELETE ON public.remittances
  FOR EACH ROW EXECUTE FUNCTION public.guard_remittance_delete();
