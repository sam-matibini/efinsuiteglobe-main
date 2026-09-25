CREATE OR REPLACE FUNCTION public.recalculate_all_account_balances(p_organization_id uuid DEFAULT NULL::uuid)
RETURNS TABLE(
  account_id uuid,
  account_code text,
  account_name text,
  old_balance numeric,
  new_balance numeric,
  difference numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH recalculated AS (
    SELECT 
      a.id,
      a.code,
      a.name,
      a.current_balance as old_bal,
      public.recalculate_account_balance(a.id) as new_bal
    FROM public.accounts a
    WHERE a.is_header = false
      AND a.is_active = true
      AND (p_organization_id IS NULL OR a.organization_id = p_organization_id)
  )
  UPDATE public.accounts acc
  SET current_balance = r.new_bal,
      updated_at = now()
  FROM recalculated r
  WHERE acc.id = r.id
  RETURNING 
    r.id::uuid,
    r.code::text,
    r.name::text,
    r.old_bal::numeric,
    r.new_bal::numeric,
    (r.new_bal - COALESCE(r.old_bal, 0))::numeric;
END;
$$;