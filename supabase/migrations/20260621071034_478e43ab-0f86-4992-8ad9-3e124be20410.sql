
-- Storage policies for dispute-evidence bucket. Path convention: {organization_id}/{dispute_id}/{filename}
CREATE POLICY "Org members read dispute evidence files"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'dispute-evidence'
    AND public.is_org_member(auth.uid(), (storage.foldername(name))[1]::uuid)
  );

CREATE POLICY "Org members upload dispute evidence files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'dispute-evidence'
    AND public.is_org_member(auth.uid(), (storage.foldername(name))[1]::uuid)
  );

CREATE POLICY "Org members update dispute evidence files"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'dispute-evidence'
    AND public.is_org_member(auth.uid(), (storage.foldername(name))[1]::uuid)
  );

CREATE POLICY "Org members delete dispute evidence files"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'dispute-evidence'
    AND public.is_org_member(auth.uid(), (storage.foldername(name))[1]::uuid)
  );
