
DROP POLICY IF EXISTS docsign_docs_select_authorized ON storage.objects;
CREATE POLICY docsign_docs_select_authorized ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'docsign-documents' AND (
    owner = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.documents d
      JOIN public.organization_members m ON m.organization_id = d.organization_id
      WHERE m.user_id = auth.uid()
        AND (
          d.file_url LIKE '%/docsign-documents/' || storage.objects.name || '%'
          OR d.original_file_url LIKE '%/docsign-documents/' || storage.objects.name || '%'
          OR d.signed_pdf_url LIKE '%/docsign-documents/' || storage.objects.name || '%'
        )
    )
  )
);
