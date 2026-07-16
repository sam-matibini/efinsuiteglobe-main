ALTER TABLE public.ai_categorization_applications
  ADD COLUMN IF NOT EXISTS reasoning text;