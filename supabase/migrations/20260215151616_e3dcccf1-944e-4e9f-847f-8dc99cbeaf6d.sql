
-- Add missing CRA T4/T4A fields to tax_slips table
ALTER TABLE public.tax_slips
  ADD COLUMN IF NOT EXISTS employer_address TEXT,
  ADD COLUMN IF NOT EXISTS employer_account_number TEXT,
  ADD COLUMN IF NOT EXISTS province_of_employment TEXT,
  ADD COLUMN IF NOT EXISTS employment_code TEXT,
  ADD COLUMN IF NOT EXISTS exempt_cpp BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS exempt_ei BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS exempt_ppip BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS dental_benefits_code TEXT,
  ADD COLUMN IF NOT EXISTS box_16a_cpp2_contributions NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS box_17a_qpp2_contributions NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notes TEXT;
