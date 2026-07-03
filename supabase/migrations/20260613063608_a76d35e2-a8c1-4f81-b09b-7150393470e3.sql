
-- =====================================================
-- Storage: accountant-assets
-- =====================================================
DROP POLICY IF EXISTS "Users can view accountant assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload accountant assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update accountant assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete accountant assets" ON storage.objects;
DROP POLICY IF EXISTS "accountant_assets_authenticated_select" ON storage.objects;

CREATE POLICY "accountant_assets_select_authenticated"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'accountant-assets' AND auth.uid() IS NOT NULL);

CREATE POLICY "accountant_assets_insert_own_folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'accountant-assets'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "accountant_assets_update_owner"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'accountant-assets' AND owner = auth.uid())
WITH CHECK (bucket_id = 'accountant-assets' AND owner = auth.uid());

CREATE POLICY "accountant_assets_delete_owner"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'accountant-assets' AND owner = auth.uid());

-- =====================================================
-- Storage: docsign-documents
-- =====================================================
DROP POLICY IF EXISTS "docsign_docs_org_select" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload docsign documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update docsign documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete docsign documents" ON storage.objects;
DROP POLICY IF EXISTS "docsign_docs_authenticated_insert" ON storage.objects;
DROP POLICY IF EXISTS "docsign_docs_owner_update" ON storage.objects;
DROP POLICY IF EXISTS "docsign_docs_owner_delete" ON storage.objects;

CREATE POLICY "docsign_docs_select_authenticated"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'docsign-documents' AND auth.uid() IS NOT NULL);

CREATE POLICY "docsign_docs_insert_authenticated"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'docsign-documents' AND auth.uid() IS NOT NULL);

CREATE POLICY "docsign_docs_update_owner"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'docsign-documents' AND owner = auth.uid())
WITH CHECK (bucket_id = 'docsign-documents' AND owner = auth.uid());

CREATE POLICY "docsign_docs_delete_owner"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'docsign-documents' AND owner = auth.uid());

-- =====================================================
-- Storage: documents
-- =====================================================
DROP POLICY IF EXISTS "Authenticated users can delete documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload documents" ON storage.objects;
DROP POLICY IF EXISTS "documents_authenticated_select" ON storage.objects;
DROP POLICY IF EXISTS "documents_owner_update" ON storage.objects;
DROP POLICY IF EXISTS "documents_owner_delete" ON storage.objects;
DROP POLICY IF EXISTS "documents_insert_authenticated" ON storage.objects;

CREATE POLICY "documents_select_authenticated"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'documents' AND auth.uid() IS NOT NULL);

CREATE POLICY "documents_insert_authenticated"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'documents' AND auth.uid() IS NOT NULL);

CREATE POLICY "documents_update_owner"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'documents' AND owner = auth.uid())
WITH CHECK (bucket_id = 'documents' AND owner = auth.uid());

CREATE POLICY "documents_delete_owner"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'documents' AND owner = auth.uid());

-- =====================================================
-- Tables: inventory_valuations & cost_allocations
-- Replace owner-only policies with is_org_member
-- =====================================================
DROP POLICY IF EXISTS "Users can view own org inventory valuations" ON public.inventory_valuations;
DROP POLICY IF EXISTS "Users can create own org inventory valuations" ON public.inventory_valuations;
DROP POLICY IF EXISTS "Users can update own org inventory valuations" ON public.inventory_valuations;
DROP POLICY IF EXISTS "Users can delete own org inventory valuations" ON public.inventory_valuations;

CREATE POLICY "Org members can view inventory valuations"
ON public.inventory_valuations FOR SELECT TO authenticated
USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members can create inventory valuations"
ON public.inventory_valuations FOR INSERT TO authenticated
WITH CHECK (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members can update inventory valuations"
ON public.inventory_valuations FOR UPDATE TO authenticated
USING (public.is_org_member(auth.uid(), organization_id))
WITH CHECK (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members can delete inventory valuations"
ON public.inventory_valuations FOR DELETE TO authenticated
USING (public.is_org_member(auth.uid(), organization_id));

DROP POLICY IF EXISTS "Users can view own org cost allocations" ON public.cost_allocations;
DROP POLICY IF EXISTS "Users can create own org cost allocations" ON public.cost_allocations;
DROP POLICY IF EXISTS "Users can update own org cost allocations" ON public.cost_allocations;
DROP POLICY IF EXISTS "Users can delete own org cost allocations" ON public.cost_allocations;

CREATE POLICY "Org members can view cost allocations"
ON public.cost_allocations FOR SELECT TO authenticated
USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members can create cost allocations"
ON public.cost_allocations FOR INSERT TO authenticated
WITH CHECK (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members can update cost allocations"
ON public.cost_allocations FOR UPDATE TO authenticated
USING (public.is_org_member(auth.uid(), organization_id))
WITH CHECK (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members can delete cost allocations"
ON public.cost_allocations FOR DELETE TO authenticated
USING (public.is_org_member(auth.uid(), organization_id));
