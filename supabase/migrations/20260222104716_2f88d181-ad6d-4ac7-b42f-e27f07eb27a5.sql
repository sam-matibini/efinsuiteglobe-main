
CREATE POLICY "public_read_invoice_logos"
ON storage.objects FOR SELECT TO public
USING (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] = 'invoice-logos'
);

CREATE POLICY "public_read_organization_logos"
ON storage.objects FOR SELECT TO public
USING (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] = 'organization-logos'
);
