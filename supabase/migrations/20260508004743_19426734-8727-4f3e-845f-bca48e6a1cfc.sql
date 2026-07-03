
-- 1. Fix privilege escalation on organization_members
DROP POLICY IF EXISTS "Org admins can update members" ON public.organization_members;

CREATE POLICY "Org admins can update members"
ON public.organization_members
FOR UPDATE
USING (
  is_org_admin_or_owner(organization_id, auth.uid())
  OR user_id = auth.uid()
)
WITH CHECK (
  -- Only admins/owners may write any row. Self-updates are blocked here to prevent
  -- role escalation; members can read their row but not modify it via this policy.
  is_org_admin_or_owner(organization_id, auth.uid())
);

-- 2. Recreate views with SECURITY INVOKER so RLS on underlying tables applies
ALTER VIEW public.detailed_ledger_view SET (security_invoker = true);
ALTER VIEW public.vw_opening_retained_earnings SET (security_invoker = true);
ALTER VIEW public.vw_retained_earnings_closing SET (security_invoker = true);
ALTER VIEW public.vw_net_income_by_year SET (security_invoker = true);
ALTER VIEW public.vw_soce_aspe_detail SET (security_invoker = true);
ALTER VIEW public.vw_soce_aspe_comparative SET (security_invoker = true);
ALTER VIEW public.organization_invitation_history SET (security_invoker = true);
