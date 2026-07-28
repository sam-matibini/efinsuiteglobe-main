
-- Close out the legacy PAYE bracket version at 31 Dec 2025
UPDATE public.ng_tax_rate_versions v
SET effective_to = DATE '2025-12-31'
FROM public.ng_tax_definitions d
WHERE v.definition_id = d.id
  AND d.code = 'NG-PAYE'
  AND d.organization_id IS NULL
  AND v.effective_from = DATE '2023-01-01'
  AND v.effective_to IS NULL;

-- Insert NTA 2025 PAYE bands (effective 2026-01-01)
INSERT INTO public.ng_tax_rate_versions
  (definition_id, effective_from, calculation_method, rate, brackets, formula, source_reference)
SELECT
  d.id,
  DATE '2026-01-01',
  'progressive',
  NULL::numeric,
  '[
     {"min":0,          "max":800000,    "rate":0},
     {"min":800000,     "max":3000000,   "rate":15},
     {"min":3000000,    "max":12000000,  "rate":18},
     {"min":12000000,   "max":25000000,  "rate":21},
     {"min":25000000,   "max":50000000,  "rate":23},
     {"min":50000000,   "max":null,      "rate":25}
   ]'::jsonb,
  '{"rent_relief":{"lower_of":[{"op":"mul","args":["annual_rent",0.20]},500000]}}'::jsonb,
  'Nigeria Tax Act 2025 (NTA 2025), effective 1 Jan 2026 — NRS guideline'
FROM public.ng_tax_definitions d
WHERE d.code = 'NG-PAYE' AND d.organization_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.ng_tax_rate_versions v2
    WHERE v2.definition_id = d.id AND v2.effective_from = DATE '2026-01-01'
  );

-- Update PAYE definition source reference
UPDATE public.ng_tax_definitions
SET description = 'State IRS PAYE progressive — NTA 2025 (0–25% bands, Rent Relief)'
WHERE code = 'NG-PAYE' AND organization_id IS NULL;

-- Close CRA at 31 Dec 2025
UPDATE public.ng_tax_reliefs
SET effective_to = DATE '2025-12-31'
WHERE code = 'CRA' AND organization_id IS NULL AND effective_to IS NULL;

-- Insert Rent Relief (NTA 2025)
-- Widen relief_type constraint to allow the new 'rent' category (NTA 2025)
ALTER TABLE public.ng_tax_reliefs DROP CONSTRAINT IF EXISTS ng_tax_reliefs_relief_type_check;
ALTER TABLE public.ng_tax_reliefs ADD CONSTRAINT ng_tax_reliefs_relief_type_check
  CHECK (relief_type IN ('cra','pension','nhf','nhis','life_assurance','gratuity','rent','other'));

INSERT INTO public.ng_tax_reliefs (organization_id, code, name, relief_type, formula, effective_from)
SELECT NULL, 'RENT-RELIEF', 'Rent Relief (NTA 2025)', 'rent',
  '{"lower_of":[{"op":"mul","args":["annual_rent",0.20]},500000]}'::jsonb,
  DATE '2026-01-01'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ng_tax_reliefs WHERE code = 'RENT-RELIEF' AND organization_id IS NULL
);
