CREATE POLICY "Org members upload organization logos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'organization-logos'
  AND is_org_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "Org members update organization logos"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'organization-logos'
  AND is_org_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
)
WITH CHECK (
  bucket_id = 'organization-logos'
  AND is_org_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "Org members delete organization logos"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'organization-logos'
  AND is_org_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "Public read organization logos bucket"
ON storage.objects FOR SELECT TO public
USING (
  bucket_id = 'organization-logos'
  AND coalesce((metadata->>'mimetype'), '') LIKE 'image/%'
);