-- =========================================================================
-- COMBINED SALES TAX SYSTEM FOR CANADIAN PROVINCES
-- Supports: GST-only, GST+PST (separate), HST (combined single)
-- =========================================================================

-- 1. Add tax_model enum and column to jurisdictions table
-- This identifies the tax model for each province/territory
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tax_model_type') THEN
    CREATE TYPE tax_model_type AS ENUM ('GST_ONLY', 'GST_PST', 'HST');
  END IF;
END $$;

ALTER TABLE public.jurisdictions 
ADD COLUMN IF NOT EXISTS tax_model text DEFAULT 'GST_ONLY';

ALTER TABLE public.jurisdictions 
ADD COLUMN IF NOT EXISTS requires_separate_pst_accounting boolean DEFAULT false;

-- 2. Update Canadian provinces with correct tax models
UPDATE public.jurisdictions j
SET tax_model = CASE j.code
  -- HST Provinces (single combined tax)
  WHEN 'ON' THEN 'HST'
  WHEN 'NB' THEN 'HST'
  WHEN 'NL' THEN 'HST'
  WHEN 'NS' THEN 'HST'
  WHEN 'PE' THEN 'HST'
  -- GST+PST Provinces (separate accounting required)
  WHEN 'BC' THEN 'GST_PST'
  WHEN 'SK' THEN 'GST_PST'
  WHEN 'MB' THEN 'GST_PST'
  WHEN 'QC' THEN 'GST_PST'
  -- GST-only provinces/territories
  ELSE 'GST_ONLY'
END,
requires_separate_pst_accounting = CASE j.code
  WHEN 'BC' THEN true
  WHEN 'SK' THEN true
  WHEN 'MB' THEN true
  WHEN 'QC' THEN true
  ELSE false
END
FROM public.countries c
WHERE j.country_id = c.id AND c.code = 'CA';

-- 3. Add authority column to tax_types to identify CRA vs Provincial
ALTER TABLE public.tax_types 
ADD COLUMN IF NOT EXISTS tax_authority text DEFAULT 'federal';

-- Update authority for existing Canadian tax types
UPDATE public.tax_types tt
SET tax_authority = CASE tt.code
  WHEN 'GST' THEN 'CRA'
  WHEN 'GST-EXEMPT' THEN 'CRA'
  WHEN 'GST-ZERO' THEN 'CRA'
  WHEN 'HST' THEN 'CRA'
  WHEN 'PST' THEN 'provincial'
  WHEN 'QST' THEN 'Revenu Quebec'
  ELSE 'federal'
END
FROM public.countries c
WHERE tt.country_id = c.id AND c.code = 'CA';

-- 4. Link tax_rates to jurisdictions where missing (for PST rates)
-- First ensure jurisdiction_id is set for provincial rates
UPDATE public.tax_rates tr
SET jurisdiction_id = (
  SELECT j.id FROM public.jurisdictions j
  JOIN public.countries c ON j.country_id = c.id
  WHERE c.code = 'CA' 
  AND (
    (tr.rate_name ILIKE '%BC%' AND j.code = 'BC') OR
    (tr.rate_name ILIKE '%SK%' AND j.code = 'SK') OR
    (tr.rate_name ILIKE '%MB%' AND j.code = 'MB') OR
    (tr.rate_name ILIKE '%Quebec%' AND j.code = 'QC') OR
    (tr.rate_name ILIKE '%Ontario%' AND j.code = 'ON') OR
    (tr.rate_name ILIKE '%NB%' AND j.code = 'NB') OR
    (tr.rate_name ILIKE '%NS%' AND j.code = 'NS') OR
    (tr.rate_name ILIKE '%NL%' AND j.code = 'NL') OR
    (tr.rate_name ILIKE '%PE%' AND j.code = 'PE')
  )
  LIMIT 1
)
WHERE tr.jurisdiction_id IS NULL
AND EXISTS (
  SELECT 1 FROM public.tax_types tt
  JOIN public.countries c ON tt.country_id = c.id
  WHERE tt.id = tr.tax_type_id AND c.code = 'CA'
);

-- 5. Add component taxes support to tax_codes table
-- This allows a combined tax code (GST+PST) to reference individual components
ALTER TABLE public.tax_codes
ADD COLUMN IF NOT EXISTS is_combined boolean DEFAULT false;

ALTER TABLE public.tax_codes
ADD COLUMN IF NOT EXISTS component_tax_codes jsonb DEFAULT NULL;

-- component_tax_codes example: [{"code": "GST", "rate": 5}, {"code": "PST-MB", "rate": 7}]

ALTER TABLE public.tax_codes
ADD COLUMN IF NOT EXISTS show_combined_display boolean DEFAULT true;

-- 6. Create combined_tax_rates view (LOGICAL, not stored)
-- This view calculates combined rates from separate GST + PST for display purposes
CREATE OR REPLACE VIEW public.combined_tax_rates AS
WITH provincial_rates AS (
  SELECT 
    j.id as jurisdiction_id,
    j.code as jurisdiction_code,
    j.name as jurisdiction_name,
    j.tax_model,
    j.requires_separate_pst_accounting,
    c.code as country_code,
    -- GST rate (federal, 5%)
    5.0 as gst_rate,
    -- PST/QST rate based on province
    CASE j.code
      WHEN 'BC' THEN 7.0
      WHEN 'SK' THEN 6.0
      WHEN 'MB' THEN 7.0
      WHEN 'QC' THEN 9.975
      ELSE 0.0
    END as pst_rate,
    -- HST rate (if applicable)
    CASE j.code
      WHEN 'ON' THEN 13.0
      WHEN 'NB' THEN 15.0
      WHEN 'NL' THEN 15.0
      WHEN 'NS' THEN 15.0
      WHEN 'PE' THEN 15.0
      ELSE 0.0
    END as hst_rate
  FROM public.jurisdictions j
  JOIN public.countries c ON j.country_id = c.id
  WHERE c.code = 'CA'
)
SELECT 
  pr.jurisdiction_id,
  pr.jurisdiction_code,
  pr.jurisdiction_name,
  pr.tax_model,
  pr.requires_separate_pst_accounting,
  pr.country_code,
  pr.gst_rate,
  pr.pst_rate,
  pr.hst_rate,
  -- Combined rate for display only
  CASE pr.tax_model
    WHEN 'HST' THEN pr.hst_rate
    WHEN 'GST_PST' THEN pr.gst_rate + pr.pst_rate
    ELSE pr.gst_rate
  END as combined_rate,
  -- Breakdown JSON for UI
  CASE pr.tax_model
    WHEN 'HST' THEN jsonb_build_array(
      jsonb_build_object('code', 'HST', 'rate', pr.hst_rate, 'authority', 'CRA')
    )
    WHEN 'GST_PST' THEN jsonb_build_array(
      jsonb_build_object('code', 'GST', 'rate', pr.gst_rate, 'authority', 'CRA'),
      jsonb_build_object(
        'code', CASE pr.jurisdiction_code WHEN 'QC' THEN 'QST' ELSE 'PST' END, 
        'rate', pr.pst_rate, 
        'authority', CASE pr.jurisdiction_code WHEN 'QC' THEN 'Revenu Quebec' ELSE pr.jurisdiction_name END
      )
    )
    ELSE jsonb_build_array(
      jsonb_build_object('code', 'GST', 'rate', pr.gst_rate, 'authority', 'CRA')
    )
  END as breakdown_json
FROM provincial_rates pr;

-- 7. Add invoice_taxes table for storing split tax breakdown per invoice
CREATE TABLE IF NOT EXISTS public.invoice_taxes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  tax_type text NOT NULL, -- 'GST', 'PST', 'HST', 'QST'
  tax_code text,
  rate numeric(8,4) NOT NULL,
  taxable_amount numeric(12,2) NOT NULL,
  tax_amount numeric(12,2) NOT NULL,
  is_recoverable boolean DEFAULT true,
  gl_account_id uuid REFERENCES public.accounts(id),
  authority text, -- 'CRA', 'Province', 'Revenu Quebec'
  jurisdiction_code text,
  created_at timestamptz DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_invoice_taxes_invoice_id ON public.invoice_taxes(invoice_id);

-- 8. Add bill_taxes table for purchase-side split taxes
CREATE TABLE IF NOT EXISTS public.bill_taxes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id uuid NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
  tax_type text NOT NULL,
  tax_code text,
  rate numeric(8,4) NOT NULL,
  taxable_amount numeric(12,2) NOT NULL,
  tax_amount numeric(12,2) NOT NULL,
  is_recoverable boolean DEFAULT true,
  gl_account_id uuid REFERENCES public.accounts(id),
  authority text,
  jurisdiction_code text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bill_taxes_bill_id ON public.bill_taxes(bill_id);

-- 9. Add expense_taxes table for expense-side split taxes
CREATE TABLE IF NOT EXISTS public.expense_taxes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id uuid NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
  tax_type text NOT NULL,
  tax_code text,
  rate numeric(8,4) NOT NULL,
  taxable_amount numeric(12,2) NOT NULL,
  tax_amount numeric(12,2) NOT NULL,
  is_recoverable boolean DEFAULT true,
  gl_account_id uuid REFERENCES public.accounts(id),
  authority text,
  jurisdiction_code text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expense_taxes_expense_id ON public.expense_taxes(expense_id);

-- 10. Enable RLS on new tables
ALTER TABLE public.invoice_taxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bill_taxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_taxes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for invoice_taxes (access through invoice)
CREATE POLICY "Users can view invoice taxes through invoice access"
ON public.invoice_taxes FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.invoices i
    WHERE i.id = invoice_taxes.invoice_id
    AND public.is_org_member(auth.uid(), i.organization_id)
  )
);

CREATE POLICY "Users can insert invoice taxes for accessible invoices"
ON public.invoice_taxes FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.invoices i
    WHERE i.id = invoice_id
    AND public.is_org_member(auth.uid(), i.organization_id)
  )
);

CREATE POLICY "Users can update invoice taxes for accessible invoices"
ON public.invoice_taxes FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.invoices i
    WHERE i.id = invoice_taxes.invoice_id
    AND public.is_org_member(auth.uid(), i.organization_id)
  )
);

CREATE POLICY "Users can delete invoice taxes for accessible invoices"
ON public.invoice_taxes FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.invoices i
    WHERE i.id = invoice_taxes.invoice_id
    AND public.is_org_member(auth.uid(), i.organization_id)
  )
);

-- RLS Policies for bill_taxes
CREATE POLICY "Users can view bill taxes through bill access"
ON public.bill_taxes FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.bills b
    WHERE b.id = bill_taxes.bill_id
    AND public.is_org_member(auth.uid(), b.organization_id)
  )
);

CREATE POLICY "Users can insert bill taxes for accessible bills"
ON public.bill_taxes FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.bills b
    WHERE b.id = bill_id
    AND public.is_org_member(auth.uid(), b.organization_id)
  )
);

CREATE POLICY "Users can update bill taxes for accessible bills"
ON public.bill_taxes FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.bills b
    WHERE b.id = bill_taxes.bill_id
    AND public.is_org_member(auth.uid(), b.organization_id)
  )
);

CREATE POLICY "Users can delete bill taxes for accessible bills"
ON public.bill_taxes FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.bills b
    WHERE b.id = bill_taxes.bill_id
    AND public.is_org_member(auth.uid(), b.organization_id)
  )
);

-- RLS Policies for expense_taxes
CREATE POLICY "Users can view expense taxes through expense access"
ON public.expense_taxes FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.expenses e
    WHERE e.id = expense_taxes.expense_id
    AND public.is_org_member(auth.uid(), e.organization_id)
  )
);

CREATE POLICY "Users can insert expense taxes for accessible expenses"
ON public.expense_taxes FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.expenses e
    WHERE e.id = expense_id
    AND public.is_org_member(auth.uid(), e.organization_id)
  )
);

CREATE POLICY "Users can update expense taxes for accessible expenses"
ON public.expense_taxes FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.expenses e
    WHERE e.id = expense_taxes.expense_id
    AND public.is_org_member(auth.uid(), e.organization_id)
  )
);

CREATE POLICY "Users can delete expense taxes for accessible expenses"
ON public.expense_taxes FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.expenses e
    WHERE e.id = expense_taxes.expense_id
    AND public.is_org_member(auth.uid(), e.organization_id)
  )
);

-- 11. Create function to calculate split taxes for a transaction
CREATE OR REPLACE FUNCTION public.calculate_split_taxes(
  p_amount numeric,
  p_jurisdiction_code text,
  p_is_inclusive boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_tax_model text;
  v_gst_rate numeric := 5.0;
  v_pst_rate numeric := 0;
  v_hst_rate numeric := 0;
  v_taxable_amount numeric;
  v_gst_amount numeric := 0;
  v_pst_amount numeric := 0;
  v_hst_amount numeric := 0;
  v_total_tax numeric := 0;
BEGIN
  -- Get tax model for jurisdiction
  SELECT tax_model INTO v_tax_model
  FROM public.jurisdictions j
  JOIN public.countries c ON j.country_id = c.id
  WHERE c.code = 'CA' AND j.code = p_jurisdiction_code;
  
  -- Default to GST_ONLY if not found
  v_tax_model := COALESCE(v_tax_model, 'GST_ONLY');
  
  -- Set rates based on jurisdiction
  CASE p_jurisdiction_code
    WHEN 'ON' THEN v_hst_rate := 13.0;
    WHEN 'NB' THEN v_hst_rate := 15.0;
    WHEN 'NL' THEN v_hst_rate := 15.0;
    WHEN 'NS' THEN v_hst_rate := 15.0;
    WHEN 'PE' THEN v_hst_rate := 15.0;
    WHEN 'BC' THEN v_pst_rate := 7.0;
    WHEN 'SK' THEN v_pst_rate := 6.0;
    WHEN 'MB' THEN v_pst_rate := 7.0;
    WHEN 'QC' THEN v_pst_rate := 9.975;
    ELSE NULL;
  END CASE;
  
  -- Calculate taxable amount
  IF p_is_inclusive THEN
    -- Back-calculate from tax-inclusive amount
    CASE v_tax_model
      WHEN 'HST' THEN
        v_taxable_amount := p_amount / (1 + v_hst_rate / 100);
      WHEN 'GST_PST' THEN
        v_taxable_amount := p_amount / (1 + (v_gst_rate + v_pst_rate) / 100);
      ELSE
        v_taxable_amount := p_amount / (1 + v_gst_rate / 100);
    END CASE;
  ELSE
    v_taxable_amount := p_amount;
  END IF;
  
  -- Calculate taxes separately (CRITICAL: never combine in storage)
  CASE v_tax_model
    WHEN 'HST' THEN
      v_hst_amount := ROUND(v_taxable_amount * v_hst_rate / 100, 2);
      v_total_tax := v_hst_amount;
    WHEN 'GST_PST' THEN
      v_gst_amount := ROUND(v_taxable_amount * v_gst_rate / 100, 2);
      v_pst_amount := ROUND(v_taxable_amount * v_pst_rate / 100, 2);
      v_total_tax := v_gst_amount + v_pst_amount;
    ELSE
      v_gst_amount := ROUND(v_taxable_amount * v_gst_rate / 100, 2);
      v_total_tax := v_gst_amount;
  END CASE;
  
  -- Build result
  v_result := jsonb_build_object(
    'taxable_amount', ROUND(v_taxable_amount, 2),
    'tax_model', v_tax_model,
    'jurisdiction_code', p_jurisdiction_code,
    'total_tax', v_total_tax,
    'gross_amount', ROUND(v_taxable_amount + v_total_tax, 2),
    'combined_rate', CASE v_tax_model
      WHEN 'HST' THEN v_hst_rate
      WHEN 'GST_PST' THEN v_gst_rate + v_pst_rate
      ELSE v_gst_rate
    END,
    'taxes', CASE v_tax_model
      WHEN 'HST' THEN jsonb_build_array(
        jsonb_build_object(
          'type', 'HST',
          'code', 'HST',
          'rate', v_hst_rate,
          'amount', v_hst_amount,
          'is_recoverable', true,
          'authority', 'CRA'
        )
      )
      WHEN 'GST_PST' THEN jsonb_build_array(
        jsonb_build_object(
          'type', 'GST',
          'code', 'GST',
          'rate', v_gst_rate,
          'amount', v_gst_amount,
          'is_recoverable', true,
          'authority', 'CRA'
        ),
        jsonb_build_object(
          'type', CASE p_jurisdiction_code WHEN 'QC' THEN 'QST' ELSE 'PST' END,
          'code', CASE p_jurisdiction_code WHEN 'QC' THEN 'QST' ELSE 'PST-' || p_jurisdiction_code END,
          'rate', v_pst_rate,
          'amount', v_pst_amount,
          'is_recoverable', CASE p_jurisdiction_code WHEN 'QC' THEN true ELSE false END,
          'authority', CASE p_jurisdiction_code WHEN 'QC' THEN 'Revenu Quebec' ELSE 'Provincial' END
        )
      )
      ELSE jsonb_build_array(
        jsonb_build_object(
          'type', 'GST',
          'code', 'GST',
          'rate', v_gst_rate,
          'amount', v_gst_amount,
          'is_recoverable', true,
          'authority', 'CRA'
        )
      )
    END
  );
  
  RETURN v_result;
END;
$$;

-- Grant access to the function
GRANT EXECUTE ON FUNCTION public.calculate_split_taxes(numeric, text, boolean) TO authenticated;

-- 12. Add show_combined_tax_display column to organizations for UI preference
ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS show_combined_tax_display boolean DEFAULT true;