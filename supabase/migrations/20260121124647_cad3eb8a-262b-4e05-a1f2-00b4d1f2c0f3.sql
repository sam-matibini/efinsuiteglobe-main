-- Add country_id to fixed_assets for localization support
ALTER TABLE public.fixed_assets 
ADD COLUMN IF NOT EXISTS country_id UUID REFERENCES public.countries(id);

-- Add country_id to fixed_asset_categories for country-specific defaults
ALTER TABLE public.fixed_asset_categories 
ADD COLUMN IF NOT EXISTS country_id UUID REFERENCES public.countries(id);

-- Add country_id to cca_classes to support country-specific tax depreciation
ALTER TABLE public.cca_classes 
ADD COLUMN IF NOT EXISTS country_id UUID REFERENCES public.countries(id);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_fixed_assets_country ON public.fixed_assets(country_id);
CREATE INDEX IF NOT EXISTS idx_fixed_asset_categories_country ON public.fixed_asset_categories(country_id);
CREATE INDEX IF NOT EXISTS idx_cca_classes_country ON public.cca_classes(country_id);

-- Update existing CCA classes to be Canadian (since they're Canadian tax rules)
UPDATE public.cca_classes 
SET country_id = (SELECT id FROM public.countries WHERE code = 'CA' LIMIT 1)
WHERE country_id IS NULL;

-- Create US MACRS depreciation classes for US organizations
INSERT INTO public.cca_classes (class_number, description, rate, method, half_year_rule, recapture_eligible, terminal_loss_eligible, country_id)
SELECT 
  class_number, description, rate, method, half_year_rule, recapture_eligible, terminal_loss_eligible,
  (SELECT id FROM public.countries WHERE code = 'US' LIMIT 1)
FROM (VALUES
  ('3-Year', 'MACRS 3-Year Property (tractors, tools)', 33.33, 'declining_balance', true, true, false),
  ('5-Year', 'MACRS 5-Year Property (computers, office equipment, vehicles)', 20.00, 'declining_balance', true, true, false),
  ('7-Year', 'MACRS 7-Year Property (furniture, fixtures, machinery)', 14.29, 'declining_balance', true, true, false),
  ('10-Year', 'MACRS 10-Year Property (vessels, agricultural structures)', 10.00, 'declining_balance', true, true, false),
  ('15-Year', 'MACRS 15-Year Property (land improvements, retail facilities)', 6.67, 'declining_balance', true, true, false),
  ('20-Year', 'MACRS 20-Year Property (farm buildings, utilities)', 5.00, 'declining_balance', true, true, false),
  ('27.5-Year', 'MACRS Residential Rental Property', 3.64, 'straight_line', false, true, false),
  ('39-Year', 'MACRS Nonresidential Real Property', 2.56, 'straight_line', false, true, false)
) AS t(class_number, description, rate, method, half_year_rule, recapture_eligible, terminal_loss_eligible)
WHERE NOT EXISTS (
  SELECT 1 FROM public.cca_classes WHERE class_number = t.class_number AND country_id = (SELECT id FROM public.countries WHERE code = 'US' LIMIT 1)
);

-- Create Zambia tax depreciation classes
INSERT INTO public.cca_classes (class_number, description, rate, method, half_year_rule, recapture_eligible, terminal_loss_eligible, country_id)
SELECT 
  class_number, description, rate, method, half_year_rule, recapture_eligible, terminal_loss_eligible,
  (SELECT id FROM public.countries WHERE code = 'ZM' LIMIT 1)
FROM (VALUES
  ('Industrial', 'Industrial buildings', 5.00, 'straight_line', false, true, true),
  ('Commercial', 'Commercial buildings', 2.00, 'straight_line', false, true, true),
  ('Plant', 'Plant and machinery', 25.00, 'declining_balance', true, true, true),
  ('Motor', 'Motor vehicles', 25.00, 'declining_balance', true, true, true),
  ('Office', 'Office equipment and furniture', 25.00, 'declining_balance', true, true, true),
  ('Computer', 'Computer equipment', 25.00, 'declining_balance', true, true, true)
) AS t(class_number, description, rate, method, half_year_rule, recapture_eligible, terminal_loss_eligible)
WHERE NOT EXISTS (
  SELECT 1 FROM public.cca_classes WHERE class_number = t.class_number AND country_id = (SELECT id FROM public.countries WHERE code = 'ZM' LIMIT 1)
);

-- Create Kenya tax depreciation classes
INSERT INTO public.cca_classes (class_number, description, rate, method, half_year_rule, recapture_eligible, terminal_loss_eligible, country_id)
SELECT 
  class_number, description, rate, method, half_year_rule, recapture_eligible, terminal_loss_eligible,
  (SELECT id FROM public.countries WHERE code = 'KE' LIMIT 1)
FROM (VALUES
  ('I', 'Heavy machinery, tractors', 37.50, 'declining_balance', true, true, true),
  ('II', 'Computers and peripheral equipment', 30.00, 'declining_balance', true, true, true),
  ('III', 'Vehicles (excl. heavy commercial)', 25.00, 'declining_balance', true, true, true),
  ('IV', 'Other machinery and equipment', 12.50, 'declining_balance', true, true, true),
  ('Buildings', 'Industrial buildings', 10.00, 'straight_line', false, true, true),
  ('Hotels', 'Hotel buildings', 4.00, 'straight_line', false, true, true)
) AS t(class_number, description, rate, method, half_year_rule, recapture_eligible, terminal_loss_eligible)
WHERE NOT EXISTS (
  SELECT 1 FROM public.cca_classes WHERE class_number = t.class_number AND country_id = (SELECT id FROM public.countries WHERE code = 'KE' LIMIT 1)
);

-- Create Burundi tax depreciation classes
INSERT INTO public.cca_classes (class_number, description, rate, method, half_year_rule, recapture_eligible, terminal_loss_eligible, country_id)
SELECT 
  class_number, description, rate, method, half_year_rule, recapture_eligible, terminal_loss_eligible,
  (SELECT id FROM public.countries WHERE code = 'BI' LIMIT 1)
FROM (VALUES
  ('Buildings', 'Buildings and constructions', 5.00, 'straight_line', false, true, true),
  ('Equipment', 'Industrial equipment', 15.00, 'straight_line', false, true, true),
  ('Vehicles', 'Motor vehicles', 25.00, 'straight_line', false, true, true),
  ('Furniture', 'Office furniture and fixtures', 10.00, 'straight_line', false, true, true),
  ('IT', 'Computer equipment', 25.00, 'straight_line', false, true, true)
) AS t(class_number, description, rate, method, half_year_rule, recapture_eligible, terminal_loss_eligible)
WHERE NOT EXISTS (
  SELECT 1 FROM public.cca_classes WHERE class_number = t.class_number AND country_id = (SELECT id FROM public.countries WHERE code = 'BI' LIMIT 1)
);