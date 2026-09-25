
-- 1) New column on leases: rent / lease expense account (operating & short-term)
ALTER TABLE public.leases
  ADD COLUMN IF NOT EXISTS rent_expense_account_id uuid REFERENCES public.accounts(id);

-- 2) Extend amortization schedule for operating-lease straight-line accounting
ALTER TABLE public.lease_payment_schedule
  ADD COLUMN IF NOT EXISTS straight_line_expense numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rou_amortization_plug numeric DEFAULT 0;

-- 3) View: per-lease current / long-term liability split derived from the schedule
CREATE OR REPLACE VIEW public.v_lease_liability_current_portion
WITH (security_invoker = true) AS
WITH schedule AS (
  SELECT
    l.id                          AS lease_id,
    l.organization_id,
    l.lease_liability_account_id  AS account_id,
    l.name                        AS lease_name,
    l.lease_number,
    l.lease_type,
    l.status,
    lps.payment_date,
    lps.principal_amount,
    lps.status                    AS row_status
  FROM public.leases l
  JOIN public.lease_payment_schedule lps ON lps.lease_id = l.id
  WHERE l.status = 'active'
    AND l.lease_liability_account_id IS NOT NULL
    AND coalesce(lps.status, 'scheduled') <> 'paid'
)
SELECT
  lease_id,
  organization_id,
  account_id,
  lease_name,
  lease_number,
  lease_type,
  COALESCE(SUM(principal_amount) FILTER (
    WHERE payment_date <= (CURRENT_DATE + INTERVAL '12 months')
  ), 0)::numeric AS current_portion,
  COALESCE(SUM(principal_amount) FILTER (
    WHERE payment_date >  (CURRENT_DATE + INTERVAL '12 months')
  ), 0)::numeric AS long_term_portion,
  COALESCE(SUM(principal_amount), 0)::numeric AS total_remaining
FROM schedule
GROUP BY lease_id, organization_id, account_id, lease_name, lease_number, lease_type;

GRANT SELECT ON public.v_lease_liability_current_portion TO authenticated;
