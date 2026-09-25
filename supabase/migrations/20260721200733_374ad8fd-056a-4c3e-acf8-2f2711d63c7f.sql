ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS efinsign_document_id uuid;
ALTER TABLE public.document_signers ADD COLUMN IF NOT EXISTS efinsign_signer_id uuid;
ALTER TABLE public.document_fields ADD COLUMN IF NOT EXISTS efinsign_field_id uuid;
CREATE INDEX IF NOT EXISTS idx_documents_efinsign_id ON public.documents(efinsign_document_id);
CREATE INDEX IF NOT EXISTS idx_document_signers_efinsign_id ON public.document_signers(efinsign_signer_id);
CREATE INDEX IF NOT EXISTS idx_document_fields_efinsign_id ON public.document_fields(efinsign_field_id);