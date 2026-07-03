
CREATE OR REPLACE FUNCTION public.autofill_sales_tax_gl_accounts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- GST collected (liability)
  IF NEW.collect_gst AND NEW.gst_collected_account_id IS NULL THEN
    SELECT id INTO NEW.gst_collected_account_id
    FROM public.accounts
    WHERE organization_id = NEW.organization_id
      AND account_type = 'liability'
      AND (
        name ILIKE 'GST/HST Collected%' OR
        name ILIKE 'GST/HST Payable%' OR
        name ILIKE 'HST Payable%' OR
        name ILIKE 'GST Payable%' OR
        name ILIKE 'GST Collected%'
      )
    ORDER BY
      CASE
        WHEN name ILIKE 'GST/HST Collected%' THEN 1
        WHEN name ILIKE 'GST/HST Payable%' THEN 2
        WHEN name ILIKE 'HST Payable%' THEN 3
        WHEN name ILIKE 'GST Payable%' THEN 4
        ELSE 5
      END, code
    LIMIT 1;
  END IF;

  -- GST paid / ITC (asset)
  IF NEW.collect_gst AND NEW.gst_paid_account_id IS NULL THEN
    SELECT id INTO NEW.gst_paid_account_id
    FROM public.accounts
    WHERE organization_id = NEW.organization_id
      AND account_type = 'asset'
      AND (
        name ILIKE 'GST/HST Paid%Input Tax Credit%' OR
        name ILIKE 'GST/HST Input Tax Credit%' OR
        name ILIKE 'GST/HST Receivable%ITC%' OR
        name ILIKE 'GST/HST Receivable%' OR
        name ILIKE 'GST%Input Tax Credit%' OR
        name ILIKE 'HST%Input Tax Credit%'
      )
    ORDER BY
      CASE
        WHEN name ILIKE 'GST/HST Paid%Input Tax Credit%' THEN 1
        WHEN name ILIKE 'GST/HST Input Tax Credit%' THEN 2
        WHEN name ILIKE 'GST/HST Receivable%ITC%' THEN 3
        WHEN name ILIKE 'GST/HST Receivable%' THEN 4
        ELSE 5
      END, code
    LIMIT 1;
  END IF;

  -- PST/QST collected (liability)
  IF NEW.collect_pst AND NEW.pst_collected_account_id IS NULL THEN
    SELECT id INTO NEW.pst_collected_account_id
    FROM public.accounts
    WHERE organization_id = NEW.organization_id
      AND account_type = 'liability'
      AND (
        name ILIKE 'PST%Payable%' OR
        name ILIKE 'PST%Collected%' OR
        name ILIKE 'QST%Payable%' OR
        name ILIKE 'QST%Collected%' OR
        name ILIKE 'Provincial Sales Tax%Payable%'
      )
    ORDER BY code
    LIMIT 1;
  END IF;

  -- PST/QST paid (asset for QC, expense otherwise)
  IF NEW.collect_pst AND NEW.pst_paid_account_id IS NULL THEN
    SELECT id INTO NEW.pst_paid_account_id
    FROM public.accounts
    WHERE organization_id = NEW.organization_id
      AND (
        (account_type = 'asset' AND (name ILIKE 'QST%Input Tax Refund%' OR name ILIKE 'QST%ITR%' OR name ILIKE 'QST%Receivable%'))
        OR (account_type = 'expense' AND (name ILIKE 'PST%Paid%' OR name ILIKE 'PST%Expense%' OR name ILIKE 'PST%Non-Recoverable%'))
        OR (account_type = 'asset' AND name ILIKE 'PST%Recoverable%')
      )
    ORDER BY code
    LIMIT 1;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_autofill_sales_tax_gl ON public.sales_tax_settings;
CREATE TRIGGER trg_autofill_sales_tax_gl
BEFORE INSERT OR UPDATE ON public.sales_tax_settings
FOR EACH ROW
EXECUTE FUNCTION public.autofill_sales_tax_gl_accounts();
