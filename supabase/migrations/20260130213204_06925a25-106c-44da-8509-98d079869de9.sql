-- 1) Make org-membership helper safe for RLS usage (avoids recursive/blocked reads)
CREATE OR REPLACE FUNCTION public.is_org_member(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members
    WHERE user_id = _user_id
      AND organization_id = _org_id
  );
$$;

-- 2) Fix vendors policies to use correct argument order everywhere
DROP POLICY IF EXISTS "Users can view vendors in their organization" ON public.vendors;
CREATE POLICY "Users can view vendors in their organization"
ON public.vendors
FOR SELECT
USING (is_org_member(auth.uid(), organization_id));

DROP POLICY IF EXISTS "Users can update vendors in their organization" ON public.vendors;
CREATE POLICY "Users can update vendors in their organization"
ON public.vendors
FOR UPDATE
USING (is_org_member(auth.uid(), organization_id))
WITH CHECK (is_org_member(auth.uid(), organization_id));

DROP POLICY IF EXISTS "Users can delete vendors in their organization" ON public.vendors;
CREATE POLICY "Users can delete vendors in their organization"
ON public.vendors
FOR DELETE
USING (is_org_member(auth.uid(), organization_id));

-- Recreate INSERT policy defensively (ensures correct order)
DROP POLICY IF EXISTS "Users can create vendors in their organization" ON public.vendors;
CREATE POLICY "Users can create vendors in their organization"
ON public.vendors
FOR INSERT
WITH CHECK (is_org_member(auth.uid(), organization_id));
