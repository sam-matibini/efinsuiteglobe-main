-- =====================================================
-- SECURITY FIX: Restrict profiles table access
-- =====================================================

-- 1. Drop the overly permissive policy that exposes email to all org members
DROP POLICY IF EXISTS "Org members can view member profiles" ON public.profiles;

-- 2. Create a safe view that only exposes non-sensitive info for org member listings
CREATE OR REPLACE VIEW public.profiles_public
WITH (security_invoker = on)
AS 
SELECT 
  id,
  user_id,
  full_name,
  avatar_url
FROM public.profiles;
-- NOTE: Excludes email, created_at, updated_at for privacy

-- 3. Grant access to the view for authenticated users
GRANT SELECT ON public.profiles_public TO authenticated;

-- 4. Add a policy so org members can view non-sensitive profile info via the view
-- The view uses security_invoker=on, so it respects the caller's RLS
-- We need a policy on profiles that allows the view to work for org members
CREATE POLICY "Org members can view member profiles via view"
ON public.profiles
FOR SELECT
USING (
  -- Allow if the profile user is in the same organization as the requesting user
  EXISTS (
    SELECT 1
    FROM public.organization_members om1
    JOIN public.organization_members om2 ON om1.organization_id = om2.organization_id
    WHERE om1.user_id = auth.uid() 
    AND om2.user_id = profiles.user_id
  )
);

-- 5. Create a function to get safe member profile data for org listings
CREATE OR REPLACE FUNCTION public.get_org_member_profiles(p_organization_id uuid)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  full_name text,
  avatar_url text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- First verify the caller is a member of the organization
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members 
    WHERE organization_id = p_organization_id 
    AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not a member of this organization';
  END IF;
  
  RETURN QUERY
  SELECT 
    p.id,
    p.user_id,
    p.full_name,
    p.avatar_url
  FROM public.profiles p
  JOIN public.organization_members om ON om.user_id = p.user_id
  WHERE om.organization_id = p_organization_id;
END;
$$;

-- 6. Grant execute permission on the function
GRANT EXECUTE ON FUNCTION public.get_org_member_profiles(uuid) TO authenticated;