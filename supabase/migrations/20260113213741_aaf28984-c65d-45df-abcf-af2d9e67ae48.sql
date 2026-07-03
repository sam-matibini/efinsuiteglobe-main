-- Add country_id column to organizations table
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS country_id UUID REFERENCES public.countries(id);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_organizations_country_id ON public.organizations(country_id);