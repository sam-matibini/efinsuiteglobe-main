
-- Add Nature of Operations fields to organizations
ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS incorporation_jurisdiction text,
ADD COLUMN IF NOT EXISTS principal_activities text;

-- Add comment for documentation
COMMENT ON COLUMN public.organizations.incorporation_jurisdiction IS 'Legal jurisdiction of incorporation (e.g., "laws of the Province of Ontario")';
COMMENT ON COLUMN public.organizations.principal_activities IS 'Description of principal business activities for financial reporting';
