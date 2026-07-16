ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS ai_extraction jsonb,
  ADD COLUMN IF NOT EXISTS ai_extraction_confidence numeric,
  ADD COLUMN IF NOT EXISTS ai_extracted_at timestamptz;