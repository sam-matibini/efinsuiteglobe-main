
CREATE TABLE IF NOT EXISTS public.purchase_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('expense_claim','expense','bill','purchase_order','vendor')),
  entity_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  mime_type TEXT,
  file_size BIGINT,
  description TEXT,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_purchase_attachments_entity
  ON public.purchase_attachments(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_purchase_attachments_org
  ON public.purchase_attachments(organization_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_attachments TO authenticated;
GRANT ALL ON public.purchase_attachments TO service_role;

ALTER TABLE public.purchase_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view purchase attachments"
  ON public.purchase_attachments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = purchase_attachments.organization_id
        AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can insert purchase attachments"
  ON public.purchase_attachments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = purchase_attachments.organization_id
        AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can update purchase attachments"
  ON public.purchase_attachments FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = purchase_attachments.organization_id
        AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can delete purchase attachments"
  ON public.purchase_attachments FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = purchase_attachments.organization_id
        AND om.user_id = auth.uid()
    )
  );

CREATE TRIGGER update_purchase_attachments_updated_at
  BEFORE UPDATE ON public.purchase_attachments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage RLS policies for the purchase-attachments bucket (bucket created separately).
CREATE POLICY "Org members can read purchase-attachment files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'purchase-attachments'
    AND EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.user_id = auth.uid()
        AND om.organization_id::text = (storage.foldername(name))[1]
    )
  );

CREATE POLICY "Org members can upload purchase-attachment files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'purchase-attachments'
    AND EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.user_id = auth.uid()
        AND om.organization_id::text = (storage.foldername(name))[1]
    )
  );

CREATE POLICY "Org members can delete purchase-attachment files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'purchase-attachments'
    AND EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.user_id = auth.uid()
        AND om.organization_id::text = (storage.foldername(name))[1]
    )
  );
