-- Create documents storage bucket for MMS attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', true)
ON CONFLICT (id) DO NOTHING;

-- Create policy for authenticated users to upload files
CREATE POLICY "Authenticated users can upload documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'documents');

-- Create policy for public read access (needed for MMS URLs)
CREATE POLICY "Public read access for documents"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'documents');

-- Create policy for authenticated users to delete their uploads
CREATE POLICY "Authenticated users can delete documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'documents');