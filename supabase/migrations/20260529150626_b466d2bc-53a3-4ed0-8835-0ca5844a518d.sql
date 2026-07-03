-- Phase 11: extend tax_payments CHECK constraints for Paysafe rails
ALTER TABLE public.tax_payments DROP CONSTRAINT IF EXISTS tax_payments_payment_method_check;
ALTER TABLE public.tax_payments
  ADD CONSTRAINT tax_payments_payment_method_check
  CHECK (payment_method IN ('eft','pad','stripe','plaid_ach','manual','cra_my_payment','wire','cheque','paysafe_card','paysafe_eft','paysafe_interac'));

ALTER TABLE public.tax_payments DROP CONSTRAINT IF EXISTS tax_payments_payment_rail_check;
ALTER TABLE public.tax_payments
  ADD CONSTRAINT tax_payments_payment_rail_check
  CHECK (payment_rail IS NULL OR payment_rail IN ('manual','stripe_card','vopay_eft','vopay_pad','vopay_instant','cra_my_payment','wire','cheque','paysafe_card','paysafe_eft','paysafe_interac'));