
CREATE TABLE public.journal_entry_attachments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  journal_entry_id uuid NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_path text NOT NULL,
  mime_type text,
  file_size bigint,
  description text,
  uploaded_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_jea_je ON public.journal_entry_attachments(journal_entry_id);
CREATE INDEX idx_jea_org ON public.journal_entry_attachments(organization_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.journal_entry_attachments TO authenticated;
GRANT ALL ON public.journal_entry_attachments TO service_role;

ALTER TABLE public.journal_entry_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members view JE attachments"
  ON public.journal_entry_attachments FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members insert JE attachments"
  ON public.journal_entry_attachments FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(auth.uid(), organization_id) AND uploaded_by = auth.uid());

CREATE POLICY "Org members update JE attachments"
  ON public.journal_entry_attachments FOR UPDATE TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members delete JE attachments"
  ON public.journal_entry_attachments FOR DELETE TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE TRIGGER trg_jea_updated_at
  BEFORE UPDATE ON public.journal_entry_attachments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Org members read JE attachment files"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'journal-attachments'
    AND public.is_org_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "Org members upload JE attachment files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'journal-attachments'
    AND public.is_org_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "Org members delete JE attachment files"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'journal-attachments'
    AND public.is_org_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );
