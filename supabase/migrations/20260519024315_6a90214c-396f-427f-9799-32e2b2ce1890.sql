CREATE OR REPLACE FUNCTION public.prevent_posted_entry_modification()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  entry_status TEXT;
BEGIN
  SELECT status INTO entry_status
  FROM public.journal_entries
  WHERE id = COALESCE(OLD.journal_entry_id, NEW.journal_entry_id);

  -- Only fully lock REVERSED entries (immutable history).
  -- Posted entries may be edited; UI surfaces a warning and balance + account-balance
  -- triggers keep the ledger consistent.
  IF entry_status = 'reversed' THEN
    IF TG_OP = 'UPDATE' THEN
      RAISE EXCEPTION 'Cannot modify lines of a reversed journal entry.';
    ELSIF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'Cannot delete lines from a reversed journal entry.';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;