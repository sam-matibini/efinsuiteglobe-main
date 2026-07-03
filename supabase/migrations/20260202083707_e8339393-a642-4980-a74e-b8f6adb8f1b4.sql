-- Create private storage bucket for user signatures
INSERT INTO storage.buckets (id, name, public)
VALUES ('user-signatures', 'user-signatures', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for user-signatures bucket
CREATE POLICY "Users can upload their own signatures"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'user-signatures' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own signatures"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'user-signatures' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own signatures"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'user-signatures' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own signatures"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'user-signatures' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Add storage_url column to user_signatures table
ALTER TABLE public.user_signatures 
ADD COLUMN IF NOT EXISTS storage_url text;