-- Drop and recreate get_soce_aspe_data with updated return type
DROP FUNCTION IF EXISTS public.get_soce_aspe_data(uuid, integer, integer);

CREATE OR REPLACE FUNCTION public.get_soce_aspe_data(p_organization_id uuid, p_start_year integer, p_end_year integer)
RETURNS TABLE(
    fiscal_year integer,
    equity_category text,
    opening_balance numeric,
    contributions numeric,
    net_income numeric,
    distributions numeric,
    prior_period_adjustments numeric,
    closing_balance numeric
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    RETURN QUERY
    WITH movement_data AS (
        SELECT 
            em.fiscal_year,
            a.equity_category,
            em.movement_type,
            em.amount
        FROM public.equity_movements em
        JOIN public.accounts a ON a.id = em.equity_account_id
        WHERE em.organization_id = p_organization_id
          AND em.fiscal_year >= p_start_year
          AND em.fiscal_year <= p_end_year
    )
    SELECT 
        md.fiscal_year::integer,
        md.equity_category::text,
        COALESCE(SUM(CASE WHEN md.movement_type = 'OPENING_BALANCE' THEN md.amount END), 0)::numeric AS opening_balance,
        COALESCE(SUM(CASE WHEN md.movement_type = 'CONTRIBUTIONS' THEN md.amount END), 0)::numeric AS contributions,
        COALESCE(SUM(CASE WHEN md.movement_type = 'NET_INCOME' THEN md.amount END), 0)::numeric AS net_income,
        COALESCE(SUM(CASE WHEN md.movement_type = 'DIVIDENDS' THEN ABS(md.amount) END), 0)::numeric AS distributions,
        COALESCE(SUM(CASE WHEN md.movement_type = 'PRIOR_PERIOD_ADJUSTMENT' THEN md.amount END), 0)::numeric AS prior_period_adjustments,
        COALESCE(SUM(CASE WHEN md.movement_type = 'CLOSING_BALANCE' THEN md.amount END), 0)::numeric AS closing_balance
    FROM movement_data md
    GROUP BY md.fiscal_year, md.equity_category
    ORDER BY md.fiscal_year, md.equity_category;
END;
$function$;