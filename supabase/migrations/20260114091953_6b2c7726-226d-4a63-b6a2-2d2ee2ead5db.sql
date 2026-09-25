-- Create storage bucket for DocSign documents
INSERT INTO storage.buckets (id, name, public) 
VALUES ('docsign-documents', 'docsign-documents', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for docSign documents
CREATE POLICY "Users can view their organization's documents" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'docsign-documents');

CREATE POLICY "Users can upload documents" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'docsign-documents');

CREATE POLICY "Users can update their documents" 
ON storage.objects FOR UPDATE 
USING (bucket_id = 'docsign-documents');

CREATE POLICY "Users can delete their documents" 
ON storage.objects FOR DELETE 
USING (bucket_id = 'docsign-documents');