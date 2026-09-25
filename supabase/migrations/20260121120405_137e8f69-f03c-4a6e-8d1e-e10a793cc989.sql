-- Add half_year_convention column to fixed_assets table
ALTER TABLE public.fixed_assets 
ADD COLUMN IF NOT EXISTS half_year_convention boolean DEFAULT false;

-- Add comment explaining the column
COMMENT ON COLUMN public.fixed_assets.half_year_convention IS 'When true, applies half-year convention for first year depreciation (only 6 months depreciation in acquisition year)';