CREATE OR REPLACE FUNCTION public.validate_journal_entry_balance()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE bd NUMERIC; bc NUMERIC; s TEXT;
BEGIN
  SELECT status INTO s FROM public.journal_entries WHERE id = NEW.journal_entry_id;
  IF s = 'posted' THEN
    SELECT COALESCE(SUM(base_currency_debit),0), COALESCE(SUM(base_currency_credit),0)
    INTO bd, bc FROM public.journal_entry_lines
    WHERE journal_entry_id = NEW.journal_entry_id;
    IF ABS(bd - bc) > 0.02 THEN
      RAISE EXCEPTION 'Journal entry is not balanced in base currency. Base debits (%) must equal base credits (%)', bd, bc;
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.validate_journal_entry_completeness()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE n INTEGER; bd NUMERIC; bc NUMERIC;
BEGIN
  IF NEW.status = 'posted' AND (OLD.status IS NULL OR OLD.status != 'posted') THEN
    SELECT COUNT(*), COALESCE(SUM(base_currency_debit),0), COALESCE(SUM(base_currency_credit),0)
    INTO n, bd, bc FROM public.journal_entry_lines WHERE journal_entry_id = NEW.id;
    IF n < 2 THEN
      RAISE EXCEPTION 'Journal entry must have at least 2 lines for double-entry accounting';
    END IF;
    IF ABS(bd - bc) > 0.02 THEN
      RAISE EXCEPTION 'Cannot post unbalanced journal entry. Base debits (%) must equal base credits (%)', bd, bc;
    END IF;
  END IF;
  RETURN NEW;
END $$;