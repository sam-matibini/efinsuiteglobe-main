ALTER TABLE public.payroll_payment_batches DROP CONSTRAINT IF EXISTS payroll_payment_batches_provider_check;
ALTER TABLE public.payroll_payment_batches ADD CONSTRAINT payroll_payment_batches_provider_check CHECK (provider = ANY (ARRAY['stripe','plaid','manual','wire','cheque','wallet','paysafe_eft','paysafe_card','wise_eft','wise_etransfer','wise_card','efinmoney']));

ALTER TABLE public.payroll_payment_items DROP CONSTRAINT IF EXISTS payroll_payment_items_rail_check;
ALTER TABLE public.payroll_payment_items ADD CONSTRAINT payroll_payment_items_rail_check CHECK (rail = ANY (ARRAY['instant','ach','eft','wire','wallet_stripe','wallet_paddle','cheque','manual','card','wise_eft','wise_etransfer','wallet_efinmoney']));