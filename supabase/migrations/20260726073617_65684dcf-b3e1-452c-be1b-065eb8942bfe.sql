
CREATE POLICY "ng_tax_receipts_read" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'ng-tax-receipts'
  AND EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.user_id = auth.uid()
      AND om.organization_id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "ng_tax_receipts_write" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'ng-tax-receipts'
  AND EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.user_id = auth.uid()
      AND om.organization_id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "ng_tax_receipts_delete" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'ng-tax-receipts'
  AND EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.user_id = auth.uid()
      AND om.organization_id::text = (storage.foldername(name))[1]
      AND om.role IN ('owner','admin')
  )
);
