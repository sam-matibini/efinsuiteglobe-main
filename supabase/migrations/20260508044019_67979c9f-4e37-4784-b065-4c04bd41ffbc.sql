
ALTER TABLE public.journal_entry_lines DISABLE TRIGGER USER;

UPDATE public.journal_entry_lines
SET base_currency_debit  = COALESCE(debit, 0)  * COALESCE(exchange_rate, 1.0),
    base_currency_credit = COALESCE(credit, 0) * COALESCE(exchange_rate, 1.0)
WHERE base_currency_debit IS NULL OR base_currency_credit IS NULL;

ALTER TABLE public.journal_entry_lines ENABLE TRIGGER USER;

CREATE OR REPLACE FUNCTION public.calculate_base_currency_amounts()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.base_currency_debit  := COALESCE(NEW.debit, 0)  * COALESCE(NEW.exchange_rate, 1.0);
  NEW.base_currency_credit := COALESCE(NEW.credit, 0) * COALESCE(NEW.exchange_rate, 1.0);
  RETURN NEW;
END;
$$;
