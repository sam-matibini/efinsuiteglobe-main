ALTER TABLE public.fixed_assets
  ADD COLUMN IF NOT EXISTS acquisition_journal_id uuid REFERENCES public.journal_entries(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_fixed_assets_acquisition_journal_id
  ON public.fixed_assets(acquisition_journal_id);