DROP POLICY IF EXISTS docsign_docs_select_org_member ON storage.objects;

CREATE POLICY docsign_docs_select_authorized
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'docsign-documents'
  AND (
    owner_id = auth.uid()::text
    OR EXISTS (
      SELECT 1
      FROM public.documents d
      WHERE public.is_org_member(auth.uid(), d.organization_id)
        AND (
          d.file_url LIKE ('%' || storage.objects.name || '%')
          OR d.original_file_url LIKE ('%' || storage.objects.name || '%')
          OR d.signed_pdf_url LIKE ('%' || storage.objects.name || '%')
        )
    )
  )
);