
CREATE POLICY "Org members can read expense receipts"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'expense-receipts'
  AND public.is_org_member(auth.uid(), (storage.foldername(name))[1]::uuid)
);

CREATE POLICY "Org members can upload expense receipts"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'expense-receipts'
  AND public.is_org_member(auth.uid(), (storage.foldername(name))[1]::uuid)
);

CREATE POLICY "Org members can delete expense receipts"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'expense-receipts'
  AND public.is_org_member(auth.uid(), (storage.foldername(name))[1]::uuid)
);
