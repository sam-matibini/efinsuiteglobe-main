
-- Fix function search path for validate_depreciation_start_date
CREATE OR REPLACE FUNCTION public.validate_depreciation_start_date()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Ensure depreciation_start_date is on or after acquisition_date
  IF NEW.depreciation_start_date < NEW.acquisition_date THEN
    RAISE EXCEPTION 'Depreciation start date (%) cannot be before acquisition date (%)', 
      NEW.depreciation_start_date, NEW.acquisition_date;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Add comment explaining the validation
COMMENT ON FUNCTION public.validate_depreciation_start_date() IS 
  'Ensures depreciation cannot start before an asset is acquired. This prevents erroneous depreciation calculations for future periods.';
