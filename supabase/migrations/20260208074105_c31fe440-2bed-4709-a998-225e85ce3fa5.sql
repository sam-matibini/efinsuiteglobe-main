
-- Add trigger to prevent depreciation_start_date before acquisition_date
CREATE OR REPLACE FUNCTION public.validate_depreciation_start_date()
RETURNS TRIGGER AS $$
BEGIN
  -- Ensure depreciation_start_date is on or after acquisition_date
  IF NEW.depreciation_start_date < NEW.acquisition_date THEN
    RAISE EXCEPTION 'Depreciation start date (%) cannot be before acquisition date (%)', 
      NEW.depreciation_start_date, NEW.acquisition_date;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for insert and update
DROP TRIGGER IF EXISTS validate_depreciation_start_date_trigger ON public.fixed_assets;
CREATE TRIGGER validate_depreciation_start_date_trigger
  BEFORE INSERT OR UPDATE ON public.fixed_assets
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_depreciation_start_date();

-- Add comment explaining the validation
COMMENT ON FUNCTION public.validate_depreciation_start_date() IS 
  'Ensures depreciation cannot start before an asset is acquired. This prevents erroneous depreciation calculations for future periods.';
