-- Drop existing policies on document_fields
DROP POLICY IF EXISTS "Users can insert document fields" ON public.document_fields;
DROP POLICY IF EXISTS "Users can view document fields" ON public.document_fields;
DROP POLICY IF EXISTS "Users can update document fields" ON public.document_fields;
DROP POLICY IF EXISTS "Users can delete document fields" ON public.document_fields;

-- Create updated policies that allow org members to manage fields
CREATE POLICY "Users can insert document fields" 
ON public.document_fields FOR INSERT 
WITH CHECK (
  document_id IN (
    SELECT d.id FROM documents d
    WHERE d.owner_id = auth.uid()
    OR d.organization_id IN (
      SELECT om.organization_id FROM organization_members om WHERE om.user_id = auth.uid()
    )
  )
);

CREATE POLICY "Users can view document fields" 
ON public.document_fields FOR SELECT 
USING (
  document_id IN (
    SELECT d.id FROM documents d
    WHERE d.owner_id = auth.uid()
    OR d.organization_id IN (
      SELECT om.organization_id FROM organization_members om WHERE om.user_id = auth.uid()
    )
  )
);

CREATE POLICY "Users can update document fields" 
ON public.document_fields FOR UPDATE 
USING (
  document_id IN (
    SELECT d.id FROM documents d
    WHERE d.owner_id = auth.uid()
    OR d.organization_id IN (
      SELECT om.organization_id FROM organization_members om WHERE om.user_id = auth.uid()
    )
  )
);

CREATE POLICY "Users can delete document fields" 
ON public.document_fields FOR DELETE 
USING (
  document_id IN (
    SELECT d.id FROM documents d
    WHERE d.owner_id = auth.uid()
    OR d.organization_id IN (
      SELECT om.organization_id FROM organization_members om WHERE om.user_id = auth.uid()
    )
  )
);