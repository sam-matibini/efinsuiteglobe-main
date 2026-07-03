-- Add additional fields to compilation_reports for accountant credentials and localization
ALTER TABLE public.compilation_reports 
ADD COLUMN IF NOT EXISTS additional_qualifications text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS accountant_logo_url text,
ADD COLUMN IF NOT EXISTS accountant_signature_url text,
ADD COLUMN IF NOT EXISTS accounting_framework text DEFAULT 'ASPE' CHECK (accounting_framework IN ('ASPE', 'IFRS'));

-- Add comment for documentation
COMMENT ON COLUMN public.compilation_reports.additional_qualifications IS 'Additional professional qualifications like MBA, FCCA, CFA, etc.';
COMMENT ON COLUMN public.compilation_reports.accountant_logo_url IS 'URL to uploaded accountant/firm logo';
COMMENT ON COLUMN public.compilation_reports.accountant_signature_url IS 'URL to uploaded accountant signature image';
COMMENT ON COLUMN public.compilation_reports.accounting_framework IS 'Accounting standard framework - ASPE for Canada, IFRS for international';

-- Create storage bucket for accountant assets if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('accountant-assets', 'accountant-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for accountant assets
CREATE POLICY "Users can upload accountant assets"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'accountant-assets' AND auth.role() = 'authenticated');

CREATE POLICY "Users can view accountant assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'accountant-assets');

CREATE POLICY "Users can update their accountant assets"
ON storage.objects FOR UPDATE
USING (bucket_id = 'accountant-assets' AND auth.role() = 'authenticated');

CREATE POLICY "Users can delete their accountant assets"
ON storage.objects FOR DELETE
USING (bucket_id = 'accountant-assets' AND auth.role() = 'authenticated');