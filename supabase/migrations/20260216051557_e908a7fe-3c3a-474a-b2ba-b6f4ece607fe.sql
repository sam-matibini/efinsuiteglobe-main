ALTER TABLE public.bank_transactions
  ADD COLUMN customer_id UUID REFERENCES public.customers(id);