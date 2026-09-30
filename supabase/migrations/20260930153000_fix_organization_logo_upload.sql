-- Logo uploads were rejected for images under the 2MB picker limit.
-- The organization-logos bucket is raised to at least 5MB and image types
-- stay allowed. Writes are limited to the organization folder, matched
-- without casting a non-uuid path (that cast aborted the upload).

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'organization-logos',
  'organization-logos',
  true,
  5242880,
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']::text[]
)
ON CONFLICT (id) DO UPDATE
SET
  public = true,
  file_size_limit = GREATEST(COALESCE(storage.buckets.file_size_limit, 0), 5242880),
  allowed_mime_types = CASE
    WHEN storage.buckets.allowed_mime_types IS NULL THEN NULL
    ELSE (
      SELECT ARRAY(
        SELECT DISTINCT mime
        FROM unnest(
          storage.buckets.allowed_mime_types
          || ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']::text[]
        ) AS mime
      )
    )
  END;

CREATE OR REPLACE FUNCTION public.storage_folder_org_id(object_name text)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  folder text;
BEGIN
  folder := split_part(COALESCE(object_name, ''), '/', 1);
  IF folder ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN folder::uuid;
  END IF;
  RETURN NULL;
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.storage_folder_org_id(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.storage_folder_org_id(text) TO authenticated, service_role;

DROP POLICY IF EXISTS "Org members upload organization logos" ON storage.objects;
DROP POLICY IF EXISTS "Org members update organization logos" ON storage.objects;
DROP POLICY IF EXISTS "Org members delete organization logos" ON storage.objects;

CREATE POLICY "Org members upload organization logos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'organization-logos'
  AND public.storage_folder_org_id(name) IS NOT NULL
  AND (
    public.is_org_member(auth.uid(), public.storage_folder_org_id(name))
    OR EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.id = public.storage_folder_org_id(name)
        AND o.owner_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  )
);

CREATE POLICY "Org members update organization logos"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'organization-logos'
  AND public.storage_folder_org_id(name) IS NOT NULL
  AND (
    public.is_org_member(auth.uid(), public.storage_folder_org_id(name))
    OR EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.id = public.storage_folder_org_id(name)
        AND o.owner_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  )
)
WITH CHECK (
  bucket_id = 'organization-logos'
  AND public.storage_folder_org_id(name) IS NOT NULL
  AND (
    public.is_org_member(auth.uid(), public.storage_folder_org_id(name))
    OR EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.id = public.storage_folder_org_id(name)
        AND o.owner_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  )
);

CREATE POLICY "Org members delete organization logos"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'organization-logos'
  AND public.storage_folder_org_id(name) IS NOT NULL
  AND (
    public.is_org_member(auth.uid(), public.storage_folder_org_id(name))
    OR EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.id = public.storage_folder_org_id(name)
        AND o.owner_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  )
);

-- Organization owners and admins can save logo URLs, not only the row in owner_id.
DROP POLICY IF EXISTS "Org admins can update organizations" ON public.organizations;
CREATE POLICY "Org admins can update organizations"
ON public.organizations FOR UPDATE TO authenticated
USING (public.is_org_admin_or_owner(id, auth.uid()))
WITH CHECK (public.is_org_admin_or_owner(id, auth.uid()));
