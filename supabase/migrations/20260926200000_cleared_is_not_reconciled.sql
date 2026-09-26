-- A downloaded bank or card line is often marked cleared because the bank
-- posted it. That is not a reconciliation. Only an explicit reconciled
-- status locks the row.

CREATE OR REPLACE FUNCTION public.prevent_reconciled_bank_transaction_modification()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM 'reconciled' THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF (NEW.status IS DISTINCT FROM OLD.status)
       OR (NEW.is_cleared IS DISTINCT FROM OLD.is_cleared)
       OR (NEW.cleared_at IS DISTINCT FROM OLD.cleared_at) THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Cannot modify a reconciled bank transaction. Unreconcile the transaction first or create an adjusting entry.';
  ELSIF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Cannot delete a reconciled bank transaction. Create a reversing entry instead.';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_reconciled_cc_transaction_modification()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM 'reconciled' THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF (NEW.status IS DISTINCT FROM OLD.status)
       OR (NEW.is_cleared IS DISTINCT FROM OLD.is_cleared)
       OR (NEW.cleared_at IS DISTINCT FROM OLD.cleared_at) THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Cannot modify a reconciled credit card transaction. Unreconcile the transaction first or create an adjusting entry.';
  ELSIF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Cannot delete a reconciled credit card transaction. Create a reversing entry instead.';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;
