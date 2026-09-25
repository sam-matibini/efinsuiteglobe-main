
-- 1) Drop blanket dreamlit_app SELECT policies across all public tables
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE policyname = 'dreamlit_dreamlit_app_select_policy'
      AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I;', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- Revoke any direct privileges the dreamlit_app role holds on public schema objects
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dreamlit_app') THEN
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA public FROM dreamlit_app';
    EXECUTE 'REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM dreamlit_app';
    EXECUTE 'REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM dreamlit_app';
    EXECUTE 'REVOKE USAGE ON SCHEMA public FROM dreamlit_app';
  END IF;
END $$;

-- 2) Remove overly-broad accountant-assets storage policies (owner/folder-scoped policies remain)
DROP POLICY IF EXISTS "Users can delete their accountant assets" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their accountant assets" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload accountant assets" ON storage.objects;

-- 3) Tighten public read policies on the shared documents bucket:
--    require the object be an image mime-type so unrelated files placed under
--    those folder names cannot be read by anonymous callers.
DROP POLICY IF EXISTS public_read_invoice_logos ON storage.objects;
DROP POLICY IF EXISTS public_read_organization_logos ON storage.objects;

CREATE POLICY public_read_invoice_logos
  ON storage.objects FOR SELECT
  TO public
  USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = 'invoice-logos'
    AND coalesce((metadata->>'mimetype'), '') LIKE 'image/%'
  );

CREATE POLICY public_read_organization_logos
  ON storage.objects FOR SELECT
  TO public
  USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = 'organization-logos'
    AND coalesce((metadata->>'mimetype'), '') LIKE 'image/%'
  );
