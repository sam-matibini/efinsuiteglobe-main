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

-- Returns the organization id from a storage object name, or NULL.
-- Accepts {orgId}/file and the live invoice uploader path invoice-logos/{orgId}/file.
-- Never casts a non-uuid folder, because that cast aborts the whole upload.
CREATE OR REPLACE FUNCTION public.storage_folder_org_id(object_name text)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  first_folder text;
  second_folder text;
  uuid_pattern constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
BEGIN
  first_folder := split_part(COALESCE(object_name, ''), '/', 1);
  second_folder := split_part(COALESCE(object_name, ''), '/', 2);
  IF first_folder ~* uuid_pattern THEN
    RETURN first_folder::uuid;
  END IF;
  IF first_folder = 'invoice-logos' AND second_folder ~* uuid_pattern THEN
    RETURN second_folder::uuid;
  END IF;
  RETURN NULL;
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.storage_folder_org_id(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.storage_folder_org_id(text) TO authenticated, service_role;

-- Other storage policies cast the first folder to uuid. For the live path
-- invoice-logos/{orgId}/file that cast throws and the invoice upload fails
-- even when this bucket would otherwise allow it. Those policies now use the
-- safe function, which denies a non-uuid folder instead of aborting.
DO $$
DECLARE
  pol record;
  role_list text;
  command_name text;
  using_expr text;
  check_expr text;
  sql text;
BEGIN
  FOR pol IN
    SELECT
      p.polname,
      p.polcmd,
      p.polpermissive,
      p.polroles,
      pg_get_expr(p.polqual, p.polrelid) AS using_expr,
      pg_get_expr(p.polwithcheck, p.polrelid) AS check_expr
    FROM pg_policy p
    JOIN pg_class c ON c.oid = p.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'storage'
      AND c.relname = 'objects'
      AND (
        COALESCE(pg_get_expr(p.polqual, p.polrelid), '') LIKE '%foldername%::uuid%'
        OR COALESCE(pg_get_expr(p.polwithcheck, p.polrelid), '') LIKE '%foldername%::uuid%'
      )
  LOOP
    using_expr := pol.using_expr;
    check_expr := pol.check_expr;
    IF using_expr IS NOT NULL THEN
      using_expr := replace(using_expr, '((storage.foldername(name))[1])::uuid', 'public.storage_folder_org_id(name)');
      using_expr := replace(using_expr, '(storage.foldername(name))[1]::uuid', 'public.storage_folder_org_id(name)');
      using_expr := replace(using_expr, '((storage.foldername(objects.name))[1])::uuid', 'public.storage_folder_org_id(name)');
      using_expr := replace(using_expr, '(storage.foldername(objects.name))[1]::uuid', 'public.storage_folder_org_id(name)');
      using_expr := replace(using_expr, '((storage.foldername("name"))[1])::uuid', 'public.storage_folder_org_id(name)');
      using_expr := replace(using_expr, '(storage.foldername("name"))[1]::uuid', 'public.storage_folder_org_id(name)');
    END IF;
    IF check_expr IS NOT NULL THEN
      check_expr := replace(check_expr, '((storage.foldername(name))[1])::uuid', 'public.storage_folder_org_id(name)');
      check_expr := replace(check_expr, '(storage.foldername(name))[1]::uuid', 'public.storage_folder_org_id(name)');
      check_expr := replace(check_expr, '((storage.foldername(objects.name))[1])::uuid', 'public.storage_folder_org_id(name)');
      check_expr := replace(check_expr, '(storage.foldername(objects.name))[1]::uuid', 'public.storage_folder_org_id(name)');
      check_expr := replace(check_expr, '((storage.foldername("name"))[1])::uuid', 'public.storage_folder_org_id(name)');
      check_expr := replace(check_expr, '(storage.foldername("name"))[1]::uuid', 'public.storage_folder_org_id(name)');
    END IF;
    IF COALESCE(using_expr, '') LIKE '%foldername%::uuid%' OR COALESCE(check_expr, '') LIKE '%foldername%::uuid%' THEN
      RAISE EXCEPTION 'Storage policy % still casts a folder to uuid: % / %', pol.polname, using_expr, check_expr;
    END IF;

    IF using_expr IS NOT DISTINCT FROM pol.using_expr AND check_expr IS NOT DISTINCT FROM pol.check_expr THEN
      CONTINUE;
    END IF;

    SELECT string_agg(quote_ident(r.rolname), ', ')
      INTO role_list
    FROM pg_roles r
    WHERE r.oid = ANY (pol.polroles);

    IF role_list IS NULL THEN
      role_list := 'PUBLIC';
    END IF;

    command_name := CASE pol.polcmd
      WHEN 'r' THEN 'SELECT'
      WHEN 'a' THEN 'INSERT'
      WHEN 'w' THEN 'UPDATE'
      WHEN 'd' THEN 'DELETE'
      ELSE 'ALL'
    END;

    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.polname);

    sql := format(
      'CREATE POLICY %I ON storage.objects AS %s FOR %s TO %s',
      pol.polname,
      CASE WHEN pol.polpermissive THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END,
      command_name,
      role_list
    );
    IF using_expr IS NOT NULL THEN
      sql := sql || ' USING (' || using_expr || ')';
    END IF;
    IF check_expr IS NOT NULL THEN
      sql := sql || ' WITH CHECK (' || check_expr || ')';
    END IF;
    EXECUTE sql;
  END LOOP;
END $$;

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
