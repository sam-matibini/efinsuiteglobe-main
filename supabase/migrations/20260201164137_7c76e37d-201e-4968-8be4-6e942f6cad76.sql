-- Fix Security Definer Views by setting security_invoker = true
-- This ensures RLS policies of the querying user are enforced

-- combined_tax_rates - tax rate reference data, read-only view
ALTER VIEW public.combined_tax_rates SET (security_invoker = true);

-- detailed_ledger_view - financial ledger view, must respect user's RLS
ALTER VIEW public.detailed_ledger_view SET (security_invoker = true);

-- organization_invitation_history - invitation view, must respect user's RLS  
ALTER VIEW public.organization_invitation_history SET (security_invoker = true);

-- profiles_public - public profile view
ALTER VIEW public.profiles_public SET (security_invoker = true);

-- vw_net_income_by_year - financial view, must respect user's RLS
ALTER VIEW public.vw_net_income_by_year SET (security_invoker = true);

-- vw_opening_retained_earnings - financial view, must respect user's RLS
ALTER VIEW public.vw_opening_retained_earnings SET (security_invoker = true);

-- vw_retained_earnings_closing - financial view, must respect user's RLS
ALTER VIEW public.vw_retained_earnings_closing SET (security_invoker = true);

-- vw_soce_aspe_comparative - SOCE comparative view, must respect user's RLS
ALTER VIEW public.vw_soce_aspe_comparative SET (security_invoker = true);

-- vw_soce_aspe_detail - SOCE detail view, must respect user's RLS
ALTER VIEW public.vw_soce_aspe_detail SET (security_invoker = true);