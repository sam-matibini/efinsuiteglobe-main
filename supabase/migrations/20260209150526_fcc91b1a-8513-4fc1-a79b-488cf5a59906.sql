
-- Add CPP and EI exemption flags to employees table
ALTER TABLE public.employees 
  ADD COLUMN IF NOT EXISTS cpp_exempt boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ei_exempt boolean NOT NULL DEFAULT false;

-- Add comments for documentation
COMMENT ON COLUMN public.employees.cpp_exempt IS 'CPP exemption (e.g., First Nations employees on reserve)';
COMMENT ON COLUMN public.employees.ei_exempt IS 'EI premium exemption';
