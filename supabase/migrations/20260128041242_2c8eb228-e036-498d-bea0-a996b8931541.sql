-- =====================================================
-- FIX: INFINITE RECURSION IN ORGANIZATION_MEMBERS POLICY
-- =====================================================

-- First, drop the problematic policies
DROP POLICY IF EXISTS "Admins can update org members" ON public.organization_members;
DROP POLICY IF EXISTS "Members can update own display name" ON public.organization_members;

-- Create a security definer function to check if user is org admin/owner
CREATE OR REPLACE FUNCTION public.is_org_admin_or_owner(p_org_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.organization_members
    WHERE organization_id = p_org_id
      AND user_id = p_user_id
      AND role IN ('owner', 'admin')
  )
$$;

-- Create proper UPDATE policies using the security definer function
CREATE POLICY "Org admins can update members"
ON public.organization_members
FOR UPDATE
TO authenticated
USING (
  public.is_org_admin_or_owner(organization_id, auth.uid())
  OR user_id = auth.uid()
)
WITH CHECK (
  public.is_org_admin_or_owner(organization_id, auth.uid())
  OR user_id = auth.uid()
);

-- =====================================================
-- FIX: Update any pending invitations that were accepted
-- =====================================================
UPDATE public.organization_invitations oi
SET status = 'accepted', accepted_at = COALESCE(accepted_at, now())
WHERE oi.status = 'pending'
  AND EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = oi.organization_id
      AND om.user_id IN (
        SELECT p.user_id FROM public.profiles p 
        WHERE LOWER(p.email) = LOWER(oi.email)
      )
  );