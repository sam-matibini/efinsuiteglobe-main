
CREATE POLICY "Org members can read signed statement PDFs"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'signed-statements'
    AND public.is_org_member(auth.uid(), (storage.foldername(name))[1]::uuid)
  );

CREATE POLICY "Org members can upload signed statement PDFs"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'signed-statements'
    AND public.is_org_member(auth.uid(), (storage.foldername(name))[1]::uuid)
  );
