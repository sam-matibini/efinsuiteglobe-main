
-- Fix: Backfill organization_members for org owners who are missing from the table.
-- Scenario: user created an org before the "add as member" step was added, so they
-- are owner_id of the org but not in organization_members — causing org-membership
-- checks on documents INSERT to fail.
INSERT INTO public.organization_members (organization_id, user_id, role, created_at)
SELECT o.id, o.owner_id, 'owner', now()
FROM public.organizations o
WHERE o.owner_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = o.id AND om.user_id = o.owner_id
  )
ON CONFLICT (organization_id, user_id) DO NOTHING;

-- Fix: Replace the documents INSERT policy with one that allows authenticated
-- owners to insert, whether or not their org membership row exists yet.
DROP POLICY IF EXISTS "Users can create documents" ON public.documents;
DROP POLICY IF EXISTS "documents_insert_org_member" ON public.documents;
DROP POLICY IF EXISTS "documents_insert_authenticated" ON public.documents;
DROP POLICY IF EXISTS "documents_insert_owner" ON public.documents;
DROP POLICY IF EXISTS "documents_insert_owner_authenticated" ON public.documents;

CREATE POLICY "documents_insert_authenticated"
ON public.documents FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND owner_id = auth.uid()
  AND (
    organization_id IS NULL
    OR public.is_org_member(auth.uid(), organization_id)
    OR EXISTS (
      SELECT 1 FROM public.organizations
      WHERE id = organization_id AND owner_id = auth.uid()
    )
  )
);
