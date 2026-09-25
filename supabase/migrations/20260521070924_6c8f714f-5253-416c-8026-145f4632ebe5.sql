ALTER TABLE public.payment_links DROP CONSTRAINT IF EXISTS payment_links_payment_method_check;

UPDATE public.payment_links SET payment_method = 'any_card' WHERE payment_method = 'card';
UPDATE public.payment_links SET payment_method = 'all'      WHERE payment_method = 'both';

ALTER TABLE public.payment_links
  ADD CONSTRAINT payment_links_payment_method_check
  CHECK (payment_method = ANY (ARRAY['credit_card','debit_card','visa_debit','any_card','eft','all']));

ALTER TABLE public.payment_links ALTER COLUMN payment_method SET DEFAULT 'all';