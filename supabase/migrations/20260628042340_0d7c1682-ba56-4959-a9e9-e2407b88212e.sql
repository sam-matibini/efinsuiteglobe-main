
-- 1) accountant-assets: scope SELECT to owner's folder
DROP POLICY IF EXISTS "accountant_assets_select_authenticated" ON storage.objects;
CREATE POLICY "accountant_assets_select_own_folder"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'accountant-assets'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 2) docsign-documents: remove broad public policies (kept narrower authenticated owner policies)
DROP POLICY IF EXISTS "Users can delete their documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload documents" ON storage.objects;

-- 3) documents + docsign-documents: scope SELECT to org members
DROP POLICY IF EXISTS "documents_select_authenticated" ON storage.objects;
CREATE POLICY "documents_select_org_member"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents'
  AND public.is_org_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

DROP POLICY IF EXISTS "docsign_docs_select_authenticated" ON storage.objects;
CREATE POLICY "docsign_docs_select_org_member"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'docsign-documents'
  AND public.is_org_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
);
