CREATE OR REPLACE FUNCTION public.recompute_pay_stub_ytd(p_org_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  WITH ordered AS (
    SELECT
      ps.id,
      SUM(COALESCE(ps.gross_pay,0))        OVER w AS ytd_gross,
      SUM(COALESCE(ps.cpp_contribution,0)) OVER w AS ytd_cpp,
      SUM(COALESCE(ps.ei_premium,0))       OVER w AS ytd_ei,
      SUM(COALESCE(ps.federal_tax,0))      OVER w AS ytd_federal_tax,
      SUM(COALESCE(ps.provincial_tax,0))   OVER w AS ytd_provincial_tax
    FROM public.pay_stubs ps
    JOIN public.pay_runs pr ON pr.id = ps.pay_run_id
    WHERE pr.organization_id = p_org_id
    WINDOW w AS (
      PARTITION BY ps.employee_id, EXTRACT(YEAR FROM pr.pay_period_end)
      ORDER BY pr.pay_period_end, pr.created_at, ps.created_at
      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    )
  )
  UPDATE public.pay_stubs ps
  SET ytd_gross          = ROUND(o.ytd_gross::numeric, 2),
      ytd_cpp            = ROUND(o.ytd_cpp::numeric, 2),
      ytd_ei             = ROUND(o.ytd_ei::numeric, 2),
      ytd_federal_tax    = ROUND(o.ytd_federal_tax::numeric, 2),
      ytd_provincial_tax = ROUND(o.ytd_provincial_tax::numeric, 2)
  FROM ordered o
  WHERE ps.id = o.id;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT DISTINCT organization_id FROM public.pay_runs WHERE organization_id IS NOT NULL LOOP
    PERFORM public.recompute_pay_stub_ytd(r.organization_id);
  END LOOP;
END $$;