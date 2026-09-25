-- Add localized tax configuration to countries table
ALTER TABLE public.countries
ADD COLUMN IF NOT EXISTS tax_labels JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS tax_exemption_config JSONB DEFAULT '{}'::jsonb;

-- Add comments for documentation
COMMENT ON COLUMN public.countries.tax_labels IS 'Localized labels for tax types (e.g., GST/HST, VAT, Sales Tax)';
COMMENT ON COLUMN public.countries.tax_exemption_config IS 'Configuration for tax exemption types and labels per country';

-- Update Canada with proper tax labels and exemption config
UPDATE public.countries SET
  tax_labels = '{
    "primary_tax": "GST/HST",
    "primary_tax_full": "Goods and Services Tax / Harmonized Sales Tax",
    "secondary_tax": "PST",
    "secondary_tax_full": "Provincial Sales Tax",
    "registration_label": "Business Number",
    "primary_reg_label": "GST/HST #",
    "secondary_reg_label": "PST #"
  }'::jsonb,
  tax_exemption_config = '{
    "primary_exemption_label": "GST/HST Exempt (Export Sale)",
    "secondary_exemption_label": "PST Exempt",
    "exemption_certificate_required": true,
    "export_zero_rated": true,
    "supports_split_tax": true
  }'::jsonb
WHERE code = 'CA';

-- Update United States with sales tax config
UPDATE public.countries SET
  tax_labels = '{
    "primary_tax": "Sales Tax",
    "primary_tax_full": "State Sales Tax",
    "secondary_tax": "Local Tax",
    "secondary_tax_full": "Local Sales Tax",
    "registration_label": "EIN",
    "primary_reg_label": "State Tax ID",
    "secondary_reg_label": "Local Tax ID"
  }'::jsonb,
  tax_exemption_config = '{
    "primary_exemption_label": "Sales Tax Exempt",
    "secondary_exemption_label": "Local Tax Exempt",
    "exemption_certificate_required": true,
    "export_zero_rated": false,
    "supports_split_tax": true
  }'::jsonb
WHERE code = 'US';

-- Update United Kingdom with VAT config
UPDATE public.countries SET
  tax_labels = '{
    "primary_tax": "VAT",
    "primary_tax_full": "Value Added Tax",
    "secondary_tax": null,
    "secondary_tax_full": null,
    "registration_label": "VAT Registration Number",
    "primary_reg_label": "VAT #",
    "secondary_reg_label": null
  }'::jsonb,
  tax_exemption_config = '{
    "primary_exemption_label": "VAT Exempt / Zero-Rated",
    "secondary_exemption_label": null,
    "exemption_certificate_required": false,
    "export_zero_rated": true,
    "supports_split_tax": false
  }'::jsonb
WHERE code = 'GB';

-- Update Zambia with VAT config
UPDATE public.countries SET
  tax_labels = '{
    "primary_tax": "VAT",
    "primary_tax_full": "Value Added Tax",
    "secondary_tax": null,
    "secondary_tax_full": null,
    "registration_label": "TPIN",
    "primary_reg_label": "VAT #",
    "secondary_reg_label": null
  }'::jsonb,
  tax_exemption_config = '{
    "primary_exemption_label": "VAT Exempt",
    "secondary_exemption_label": null,
    "exemption_certificate_required": true,
    "export_zero_rated": true,
    "supports_split_tax": false
  }'::jsonb
WHERE code = 'ZM';

-- Update Kenya with VAT config
UPDATE public.countries SET
  tax_labels = '{
    "primary_tax": "VAT",
    "primary_tax_full": "Value Added Tax",
    "secondary_tax": null,
    "secondary_tax_full": null,
    "registration_label": "KRA PIN",
    "primary_reg_label": "VAT #",
    "secondary_reg_label": null
  }'::jsonb,
  tax_exemption_config = '{
    "primary_exemption_label": "VAT Exempt",
    "secondary_exemption_label": null,
    "exemption_certificate_required": true,
    "export_zero_rated": true,
    "supports_split_tax": false
  }'::jsonb
WHERE code = 'KE';

-- Update Nigeria with VAT config
UPDATE public.countries SET
  tax_labels = '{
    "primary_tax": "VAT",
    "primary_tax_full": "Value Added Tax",
    "secondary_tax": null,
    "secondary_tax_full": null,
    "registration_label": "TIN",
    "primary_reg_label": "VAT #",
    "secondary_reg_label": null
  }'::jsonb,
  tax_exemption_config = '{
    "primary_exemption_label": "VAT Exempt",
    "secondary_exemption_label": null,
    "exemption_certificate_required": true,
    "export_zero_rated": true,
    "supports_split_tax": false
  }'::jsonb
WHERE code = 'NG';

-- Update Australia with GST config
UPDATE public.countries SET
  tax_labels = '{
    "primary_tax": "GST",
    "primary_tax_full": "Goods and Services Tax",
    "secondary_tax": null,
    "secondary_tax_full": null,
    "registration_label": "ABN",
    "primary_reg_label": "ABN",
    "secondary_reg_label": null
  }'::jsonb,
  tax_exemption_config = '{
    "primary_exemption_label": "GST-Free / Input Taxed",
    "secondary_exemption_label": null,
    "exemption_certificate_required": false,
    "export_zero_rated": true,
    "supports_split_tax": false
  }'::jsonb
WHERE code = 'AU';

-- Add tax exemption certificate number field to invoices for compliance
ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS tax_exemption_certificate TEXT,
ADD COLUMN IF NOT EXISTS exemption_reason TEXT;

-- Add organization-level tax exemption defaults
ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS default_tax_exempt BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS tax_exemption_certificate TEXT;

-- Update print templates with enhanced tax exemption display config
UPDATE public.print_templates SET
  body_template = body_template || '{
    "show_exemption_certificate": true,
    "show_exemption_reason": true,
    "tax_breakdown_style": "split"
  }'::jsonb
WHERE document_type = 'invoice';