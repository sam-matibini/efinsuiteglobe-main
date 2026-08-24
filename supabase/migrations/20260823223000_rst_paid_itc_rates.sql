-- Paid RST / ITC rates: persist purchase-side tax codes (GST-ITC, HST-ITC,
-- PST-PAID, VAT-INPUT, …) and label them on tax_codes + country seeds.

ALTER TABLE public.tax_codes
  ADD COLUMN IF NOT EXISTS applies_to text NOT NULL DEFAULT 'both',
  ADD COLUMN IF NOT EXISTS paid_name text;

ALTER TABLE public.tax_codes
  DROP CONSTRAINT IF EXISTS tax_codes_applies_to_check;
ALTER TABLE public.tax_codes
  ADD CONSTRAINT tax_codes_applies_to_check
  CHECK (applies_to IN ('sales', 'purchases', 'both'));

COMMENT ON COLUMN public.tax_codes.applies_to IS
  'sales = collect/output; purchases = paid/ITC/input; both = either side';
COMMENT ON COLUMN public.tax_codes.paid_name IS
  'Localized purchase-side label (GST Paid (ITC), Input VAT, PST Paid)';

UPDATE public.tax_codes SET paid_name = CASE
  WHEN upper(code) IN ('GST') OR upper(code) LIKE 'GST%' THEN 'GST Paid (ITC)'
  WHEN upper(code) IN ('HST') OR upper(code) LIKE 'HST%' THEN 'HST Paid (ITC)'
  WHEN upper(code) IN ('QST') THEN 'QST Paid (ITR)'
  WHEN upper(code) IN ('PST') OR upper(code) LIKE 'PST%' THEN 'PST Paid'
  WHEN upper(code) IN ('SALES_TAX', 'USE_TAX') THEN 'Sales Tax Paid / Use Tax'
  WHEN upper(code) IN ('SST') THEN 'SST Paid'
  WHEN upper(tax_type) IN ('VAT', 'IVA', 'TVA', 'UST', 'BTW', 'MWST')
    OR upper(code) LIKE 'VAT%' THEN 'VAT Paid (Input VAT)'
  ELSE COALESCE(paid_name, name || ' Paid')
END
WHERE paid_name IS NULL
  AND rate > 0
  AND COALESCE(is_exempt, false) = false;

-- Purchase-side sibling codes for every existing collect/both rate
INSERT INTO public.tax_codes (
  organization_id, code, name, rate, jurisdiction, tax_type,
  is_recoverable, is_compound, is_active, is_zero_rated, is_exempt,
  gl_collected_account_id, gl_paid_account_id, applies_to, paid_name, effective_date
)
SELECT
  tc.organization_id,
  CASE
    WHEN upper(tc.code) IN ('QST') THEN 'QST-ITR'
    WHEN upper(tc.code) IN ('PST') OR upper(tc.code) LIKE 'PST-%' THEN
      CASE WHEN upper(tc.code) = 'PST' THEN 'PST-PAID' ELSE upper(tc.code) || '-PAID' END
    WHEN upper(tc.code) IN ('SALES_TAX', 'SST', 'ST') THEN upper(tc.code) || '-PAID'
    ELSE upper(tc.code) || '-ITC'
  END,
  COALESCE(tc.paid_name, tc.name || ' Paid'),
  tc.rate,
  tc.jurisdiction,
  tc.tax_type,
  CASE
    WHEN upper(tc.code) IN ('PST') OR upper(tc.code) LIKE 'PST-%' THEN false
    WHEN upper(tc.code) IN ('SALES_TAX', 'SST') THEN false
    ELSE COALESCE(tc.is_recoverable, true)
  END,
  COALESCE(tc.is_compound, false),
  COALESCE(tc.is_active, true),
  COALESCE(tc.is_zero_rated, false),
  COALESCE(tc.is_exempt, false),
  NULL,
  tc.gl_paid_account_id,
  'purchases',
  COALESCE(tc.paid_name, tc.name || ' Paid'),
  CURRENT_DATE
FROM public.tax_codes tc
WHERE tc.rate > 0
  AND COALESCE(tc.is_exempt, false) = false
  AND COALESCE(tc.is_zero_rated, false) = false
  AND COALESCE(tc.applies_to, 'both') <> 'purchases'
  AND upper(tc.code) NOT LIKE '%-ITC'
  AND upper(tc.code) NOT LIKE '%-PAID'
  AND upper(tc.code) NOT LIKE '%-ITR'
  AND upper(tc.code) NOT LIKE '%-INPUT'
  AND upper(tc.code) NOT IN ('E', 'EXEMPT', 'O/S', 'Z', 'ZR-EXP', 'USE_TAX', 'NONE', 'PROFITS')
  AND lower(COALESCE(tc.tax_type, '')) NOT IN ('exempt', 'zero-rated', 'out-of-scope', 'wht', 'levy')
ON CONFLICT (organization_id, code) DO UPDATE SET
  paid_name = COALESCE(public.tax_codes.paid_name, EXCLUDED.paid_name),
  applies_to = 'purchases',
  gl_paid_account_id = COALESCE(public.tax_codes.gl_paid_account_id, EXCLUDED.gl_paid_account_id),
  updated_at = now();

-- Seed catalog: one paid sibling per collect seed
INSERT INTO public.country_tax_code_seeds (
  country_code, jurisdiction_code, code, name, rate, tax_type, is_recoverable,
  is_zero_rated, is_exempt, collected_account_patterns, paid_account_patterns,
  collected_account_type, paid_account_type, display_order, paid_name
)
SELECT
  s.country_code,
  s.jurisdiction_code,
  CASE
    WHEN s.code IN ('QST') THEN 'QST-ITR'
    WHEN s.code IN ('PST') THEN 'PST-PAID'
    WHEN s.code IN ('SALES_TAX', 'SST', 'ST') THEN s.code || '-PAID'
    ELSE s.code || '-ITC'
  END,
  COALESCE(s.paid_name, s.name || ' Paid'),
  s.rate,
  'purchases',
  CASE WHEN s.code IN ('PST', 'SALES_TAX', 'SST', 'USE_TAX') THEN false ELSE s.is_recoverable END,
  s.is_zero_rated,
  s.is_exempt,
  '{}',
  s.paid_account_patterns,
  s.paid_account_type,
  s.paid_account_type,
  s.display_order + 1,
  COALESCE(s.paid_name, s.name || ' Paid')
FROM public.country_tax_code_seeds s
WHERE s.rate > 0
  AND s.is_exempt = false
  AND s.is_zero_rated = false
  AND s.code NOT IN ('EXEMPT', 'USE_TAX', 'ZR-EXP', 'GST_FREE', 'GST_ZERO')
  AND s.tax_type <> 'purchases'
  AND NOT EXISTS (
    SELECT 1 FROM public.country_tax_code_seeds existing
     WHERE existing.country_code = s.country_code
       AND COALESCE(existing.jurisdiction_code, '') = COALESCE(s.jurisdiction_code, '')
       AND existing.code = CASE
         WHEN s.code IN ('QST') THEN 'QST-ITR'
         WHEN s.code IN ('PST') THEN 'PST-PAID'
         WHEN s.code IN ('SALES_TAX', 'SST', 'ST') THEN s.code || '-PAID'
         ELSE s.code || '-ITC'
       END
  );

CREATE OR REPLACE FUNCTION public.seed_organization_tax_codes(_org_id uuid)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _country_code text; _province text; _inserted int := 0; _seed RECORD;
BEGIN
  SELECT UPPER(COALESCE(
           (SELECT c.code FROM public.countries c WHERE c.id = o.country_id),
           (SELECT c.code FROM public.countries c WHERE c.id = o.primary_country_id),
           NULLIF(o.country, '')
         )),
         UPPER(NULLIF(o.province, ''))
    INTO _country_code, _province
    FROM public.organizations o WHERE o.id = _org_id;
  IF _country_code IS NULL THEN RETURN 0; END IF;

  FOR _seed IN
    SELECT * FROM public.country_tax_code_seeds
     WHERE country_code = _country_code
       AND (jurisdiction_code IS NULL OR jurisdiction_code = _province)
     ORDER BY display_order, code
  LOOP
    INSERT INTO public.tax_codes (
      organization_id, code, name, rate, jurisdiction, tax_type,
      is_recoverable, is_compound, is_active, is_zero_rated, is_exempt,
      gl_collected_account_id, gl_paid_account_id, effective_date,
      applies_to, paid_name
    ) VALUES (
      _org_id, _seed.code, _seed.name, _seed.rate, _country_code,
      CASE WHEN _seed.tax_type IN ('sales', 'purchases', 'both') THEN _seed.code ELSE _seed.tax_type END,
      _seed.is_recoverable, _seed.is_compound, true, _seed.is_zero_rated, _seed.is_exempt,
      CASE WHEN _seed.tax_type = 'purchases' THEN NULL
           ELSE public.resolve_tax_gl_account(_org_id, _seed.collected_account_type, _seed.collected_account_patterns)
      END,
      public.resolve_tax_gl_account(_org_id, _seed.paid_account_type, _seed.paid_account_patterns),
      CURRENT_DATE,
      CASE WHEN _seed.tax_type IN ('sales', 'purchases', 'both') THEN _seed.tax_type ELSE 'both' END,
      _seed.paid_name
    )
    ON CONFLICT (organization_id, code) DO UPDATE SET
      gl_collected_account_id = COALESCE(public.tax_codes.gl_collected_account_id, EXCLUDED.gl_collected_account_id),
      gl_paid_account_id      = COALESCE(public.tax_codes.gl_paid_account_id,      EXCLUDED.gl_paid_account_id),
      paid_name               = COALESCE(public.tax_codes.paid_name,               EXCLUDED.paid_name),
      applies_to              = COALESCE(public.tax_codes.applies_to,              EXCLUDED.applies_to),
      updated_at = now();
    _inserted := _inserted + 1;
  END LOOP;
  RETURN _inserted;
END;
$$;
