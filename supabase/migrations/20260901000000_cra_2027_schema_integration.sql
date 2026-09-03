-- CRA 2027 XML Schema Integration
-- Step 1: Add multi-year / schema-version columns to cra_filings
-- Mirrors irs_filings which already has tax_year, xml_url, payload.

ALTER TABLE public.cra_filings
  ADD COLUMN IF NOT EXISTS tax_year INTEGER,
  ADD COLUMN IF NOT EXISTS xml_url TEXT,
  ADD COLUMN IF NOT EXISTS payload JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS schema_version TEXT DEFAULT '2027';

-- Backfill tax_year from period_end for existing records
UPDATE public.cra_filings
SET tax_year = EXTRACT(YEAR FROM period_end)::INTEGER
WHERE tax_year IS NULL;

-- Make tax_year NOT NULL after backfill
ALTER TABLE public.cra_filings
  ALTER COLUMN tax_year SET NOT NULL;

-- Constrain schema_version to known CRA schema years
ALTER TABLE public.cra_filings
  DROP CONSTRAINT IF EXISTS cra_filings_schema_version_chk;
ALTER TABLE public.cra_filings
  ADD CONSTRAINT cra_filings_schema_version_chk
  CHECK (schema_version IN ('2026', '2027'));

-- Ensure the cra-filings storage bucket exists (vendor-slip-efile references it,
-- but it was never created alongside vendor-slips / irs-filings).
INSERT INTO storage.buckets (id, name, public)
VALUES ('cra-filings', 'cra-filings', false)
ON CONFLICT (id) DO NOTHING;

-- RLS so org members can upload/read cra-filings objects.
-- Storage bucket RLS is configured via storage.objects; allow authenticated org
-- members full CRUD within the bucket. We scope by bucket id only here; finer
-- org-level scoping is enforced upstream by the Edge Function membership check.
CREATE POLICY "Org members can read cra-filings"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'cra-filings');
CREATE POLICY "Org members can insert cra-filings"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'cra-filings');
CREATE POLICY "Org members can update cra-filings"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'cra-filings');
