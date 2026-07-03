DROP VIEW IF EXISTS public.detailed_ledger_view;
DROP TRIGGER IF EXISTS trigger_calculate_base_currency ON public.journal_entry_lines;

ALTER TABLE public.journal_entry_lines ALTER COLUMN exchange_rate TYPE numeric(20,10);
ALTER TABLE public.exchange_rates ALTER COLUMN rate TYPE numeric(20,10);

CREATE OR REPLACE FUNCTION public.calculate_base_currency_amounts()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.base_currency_debit IS NULL THEN
    NEW.base_currency_debit  := ROUND(COALESCE(NEW.debit, 0)  * COALESCE(NEW.exchange_rate, 1.0), 2);
  END IF;
  IF NEW.base_currency_credit IS NULL THEN
    NEW.base_currency_credit := ROUND(COALESCE(NEW.credit, 0) * COALESCE(NEW.exchange_rate, 1.0), 2);
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER trigger_calculate_base_currency
BEFORE INSERT OR UPDATE OF debit, credit, exchange_rate
ON public.journal_entry_lines
FOR EACH ROW EXECUTE FUNCTION public.calculate_base_currency_amounts();

CREATE VIEW public.detailed_ledger_view
WITH (security_invoker = true)
AS
SELECT je.id AS journal_entry_id,
    je.organization_id,
    je.entry_date AS txn_date,
    to_char(je.entry_date::timestamp with time zone, 'YYYY-MM'::text) AS posting_period,
    je.journal_type AS source_module,
    je.reference AS reference_no,
    je.description AS entry_description,
    je.status,
    je.created_by,
    je.created_at,
    jel.id AS line_id,
    jel.account_id,
    a.code AS account_code,
    a.name AS account_name,
    a.account_type,
    a.normal_balance,
    jel.debit,
    jel.credit,
    COALESCE(jel.debit, 0::numeric) - COALESCE(jel.credit, 0::numeric) AS net_amount,
    jel.description AS line_memo,
    jel.cost_center_id,
    cc.code AS cost_center_code,
    cc.name AS cost_center_name,
    jel.department_id,
    dept.code AS department_code,
    dept.name AS department_name,
    jel.project_id,
    proj.code AS project_code,
    proj.name AS project_name,
    jel.fund_id,
    fund.code AS fund_code,
    fund.name AS fund_name,
    jel.location_id,
    loc.code AS location_code,
    loc.name AS location_name,
    jel.vendor_id,
    v.name AS vendor_name,
    jel.customer_id,
    cust.name AS customer_name,
    jel.tax_code_id,
    tc.code AS tax_code,
    tc.rate AS tax_rate,
    COALESCE(jel.currency, 'CAD'::bpchar) AS currency,
    COALESCE(jel.exchange_rate, 1.0) AS exchange_rate,
    COALESCE(jel.base_currency_debit, jel.debit) AS base_debit,
    COALESCE(jel.base_currency_credit, jel.credit) AS base_credit,
    jel.source_document_type,
    jel.source_document_id
   FROM journal_entries je
     JOIN journal_entry_lines jel ON je.id = jel.journal_entry_id
     JOIN accounts a ON jel.account_id = a.id
     LEFT JOIN cost_centers cc ON jel.cost_center_id = cc.id
     LEFT JOIN departments dept ON jel.department_id = dept.id
     LEFT JOIN projects proj ON jel.project_id = proj.id
     LEFT JOIN funds fund ON jel.fund_id = fund.id
     LEFT JOIN locations loc ON jel.location_id = loc.id
     LEFT JOIN vendors v ON jel.vendor_id = v.id
     LEFT JOIN customers cust ON jel.customer_id = cust.id
     LEFT JOIN tax_codes tc ON jel.tax_code_id = tc.id
  WHERE je.status = 'posted'::journal_entry_status;