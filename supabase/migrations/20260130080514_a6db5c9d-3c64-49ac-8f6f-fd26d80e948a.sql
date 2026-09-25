-- Create storage bucket for print document archives
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'print-archives',
  'print-archives',
  false,
  52428800, -- 50MB limit
  ARRAY['application/pdf']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for print archives
CREATE POLICY "Organization members can view their print archives"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'print-archives' 
  AND public.is_org_member(
    auth.uid(), 
    (storage.foldername(name))[1]::uuid
  )
);

CREATE POLICY "Organization admins can upload print archives"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'print-archives'
  AND public.is_org_admin_or_owner(
    (storage.foldername(name))[1]::uuid,
    auth.uid()
  )
);

CREATE POLICY "Organization admins can delete print archives"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'print-archives'
  AND public.is_org_admin_or_owner(
    (storage.foldername(name))[1]::uuid,
    auth.uid()
  )
);