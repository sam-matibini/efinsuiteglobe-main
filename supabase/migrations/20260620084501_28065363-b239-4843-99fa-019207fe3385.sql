
CREATE TABLE IF NOT EXISTS public.country_tax_code_seeds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL,
  jurisdiction_code text,
  code text NOT NULL,
  name text NOT NULL,
  rate numeric NOT NULL DEFAULT 0,
  tax_type text NOT NULL DEFAULT 'both',
  is_recoverable boolean NOT NULL DEFAULT true,
  is_compound boolean NOT NULL DEFAULT false,
  is_zero_rated boolean NOT NULL DEFAULT false,
  is_exempt boolean NOT NULL DEFAULT false,
  collected_account_patterns text[] NOT NULL DEFAULT '{}',
  paid_account_patterns text[] NOT NULL DEFAULT '{}',
  collected_account_type text NOT NULL DEFAULT 'liability',
  paid_account_type text NOT NULL DEFAULT 'asset',
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS country_tax_code_seeds_unique
  ON public.country_tax_code_seeds (country_code, COALESCE(jurisdiction_code,''), code);

GRANT SELECT ON public.country_tax_code_seeds TO authenticated, anon;
GRANT ALL ON public.country_tax_code_seeds TO service_role;
ALTER TABLE public.country_tax_code_seeds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "country_tax_code_seeds readable by all" ON public.country_tax_code_seeds;
CREATE POLICY "country_tax_code_seeds readable by all"
  ON public.country_tax_code_seeds FOR SELECT USING (true);
DROP POLICY IF EXISTS "country_tax_code_seeds service_role write" ON public.country_tax_code_seeds;
CREATE POLICY "country_tax_code_seeds service_role write"
  ON public.country_tax_code_seeds FOR ALL TO service_role USING (true) WITH CHECK (true);

INSERT INTO public.country_tax_code_seeds
  (country_code, jurisdiction_code, code, name, rate, tax_type, is_recoverable, is_zero_rated, is_exempt,
   collected_account_patterns, paid_account_patterns, collected_account_type, paid_account_type, display_order)
VALUES
  ('CA', NULL, 'GST', 'GST (5%)', 5.000, 'both', true, false, false,
    ARRAY['^GST/HST Collected','^GST/HST Payable','^HST Payable','^GST Payable','^GST Collected'],
    ARRAY['^GST/HST Paid.*Input Tax Credit','^GST/HST Input Tax Credit','^GST/HST Receivable.*ITC','^GST/HST Receivable','^GST.*Input Tax Credit','^HST.*Input Tax Credit','^GST/HST ITC'],
    'liability','asset', 10),
  ('CA', NULL, 'HST', 'HST (13%)', 13.000,'both', true, false, false,
    ARRAY['^GST/HST Collected','^GST/HST Payable','^HST Payable'],
    ARRAY['^GST/HST Paid.*Input Tax Credit','^GST/HST Input Tax Credit','^GST/HST Receivable','^GST/HST ITC','^HST.*Input Tax Credit'],
    'liability','asset', 20),
  ('CA', NULL, 'PST', 'PST (7%)', 7.000, 'both', false, false, false,
    ARRAY['^PST.*Payable','^PST.*Collected','^Provincial Sales Tax.*Payable'],
    ARRAY['^PST.*Paid','^PST.*Expense','^PST.*Non-Recoverable','^PST.*Recoverable'],
    'liability','expense', 30),
  ('CA', 'QC', 'QST', 'QST (9.975%)', 9.975,'both', true, false, false,
    ARRAY['^QST.*Payable','^QST.*Collected'],
    ARRAY['^QST.*Input Tax Refund','^QST.*ITR','^QST.*Receivable'],
    'liability','asset', 40),
  ('CA', NULL, 'ZR-EXP', 'Zero-rated Export', 0, 'sales', false, true, false, '{}','{}','liability','asset', 90),
  ('CA', NULL, 'EXEMPT', 'Exempt', 0, 'both', false, false, true, '{}','{}','liability','asset', 95),
  ('US', NULL, 'SALES_TAX', 'Sales Tax', 0, 'sales', false, false, false,
    ARRAY['^Sales Tax.*Payable','^State Sales Tax.*Payable'],
    ARRAY['^Sales Tax.*Paid','^Use Tax.*Paid'], 'liability','expense', 10),
  ('US', NULL, 'USE_TAX', 'Use Tax', 0, 'purchases', false, false, false,
    ARRAY['^Use Tax.*Payable'], ARRAY['^Use Tax.*Paid'], 'liability','expense', 20),
  ('US', NULL, 'EXEMPT', 'Exempt', 0, 'both', false, false, true, '{}','{}','liability','asset', 95),
  ('GB', NULL, 'VAT_STD', 'VAT Standard (20%)', 20.000, 'both', true, false, false,
    ARRAY['^VAT.*Payable','^VAT Output','^Output VAT','^VAT.*Collected'],
    ARRAY['^VAT.*Receivable','^VAT Input','^Input VAT','^VAT.*Paid'], 'liability','asset', 10),
  ('GB', NULL, 'VAT_RED', 'VAT Reduced (5%)', 5.000, 'both', true, false, false,
    ARRAY['^VAT.*Payable','^VAT Output','^Output VAT'],
    ARRAY['^VAT.*Receivable','^VAT Input','^Input VAT'], 'liability','asset', 20),
  ('GB', NULL, 'VAT_ZERO','VAT Zero (0%)', 0, 'both', true, true, false,
    ARRAY['^VAT.*Payable','^VAT Output'], ARRAY['^VAT.*Receivable','^VAT Input'], 'liability','asset', 30),
  ('GB', NULL, 'EXEMPT', 'Exempt', 0, 'both', false, false, true, '{}','{}','liability','asset', 95),
  ('AU', NULL, 'GST', 'GST (10%)', 10.000, 'both', true, false, false,
    ARRAY['^GST.*Payable','^GST Collected','^GST Output'],
    ARRAY['^GST.*Receivable','^GST Input','^GST Paid','^GST.*Credit'], 'liability','asset', 10),
  ('AU', NULL, 'GST_FREE', 'GST Free (0%)', 0, 'both', true, true, false, '{}','{}','liability','asset', 20),
  ('NZ', NULL, 'GST', 'GST (15%)', 15.000, 'both', true, false, false,
    ARRAY['^GST.*Payable','^GST Output'], ARRAY['^GST.*Receivable','^GST Input','^GST Paid'], 'liability','asset', 10),
  ('NZ', NULL, 'GST_ZERO', 'GST Zero (0%)', 0, 'both', true, true, false, '{}','{}','liability','asset', 20),
  ('IN', NULL, 'CGST', 'CGST (9%)', 9.000, 'both', true, false, false,
    ARRAY['^CGST.*Payable','^CGST Output'], ARRAY['^CGST.*Receivable','^CGST Input','^CGST.*Credit'], 'liability','asset', 10),
  ('IN', NULL, 'SGST', 'SGST (9%)', 9.000, 'both', true, false, false,
    ARRAY['^SGST.*Payable','^SGST Output'], ARRAY['^SGST.*Receivable','^SGST Input','^SGST.*Credit'], 'liability','asset', 20),
  ('IN', NULL, 'IGST', 'IGST (18%)', 18.000, 'both', true, false, false,
    ARRAY['^IGST.*Payable','^IGST Output'], ARRAY['^IGST.*Receivable','^IGST Input','^IGST.*Credit'], 'liability','asset', 30),
  ('AE', NULL, 'VAT', 'VAT (5%)', 5.000, 'both', true, false, false,
    ARRAY['^VAT.*Payable','^Output VAT'], ARRAY['^VAT.*Receivable','^Input VAT'], 'liability','asset', 10),
  ('SA', NULL, 'VAT', 'VAT (15%)', 15.000, 'both', true, false, false,
    ARRAY['^VAT.*Payable','^Output VAT'], ARRAY['^VAT.*Receivable','^Input VAT'], 'liability','asset', 10),
  ('QA', NULL, 'EXEMPT', 'Exempt', 0, 'both', false, false, true, '{}','{}','liability','asset', 95),
  ('KW', NULL, 'EXEMPT', 'Exempt', 0, 'both', false, false, true, '{}','{}','liability','asset', 95),
  ('OM', NULL, 'VAT', 'VAT (5%)', 5.000, 'both', true, false, false,
    ARRAY['^VAT.*Payable'], ARRAY['^VAT.*Receivable','^Input VAT'], 'liability','asset', 10),
  ('BH', NULL, 'VAT', 'VAT (10%)', 10.000, 'both', true, false, false,
    ARRAY['^VAT.*Payable'], ARRAY['^VAT.*Receivable','^Input VAT'], 'liability','asset', 10),
  ('IL', NULL, 'VAT', 'VAT (17%)', 17.000, 'both', true, false, false,
    ARRAY['^VAT.*Payable'], ARRAY['^VAT.*Receivable','^Input VAT'], 'liability','asset', 10),
  ('ZA', NULL, 'VAT', 'VAT (15%)', 15.000, 'both', true, false, false,
    ARRAY['^VAT.*Payable','^Output VAT'], ARRAY['^VAT.*Receivable','^Input VAT'], 'liability','asset', 10),
  ('NG', NULL, 'VAT', 'VAT (7.5%)', 7.500, 'both', true, false, false,
    ARRAY['^VAT.*Payable'], ARRAY['^VAT.*Receivable','^Input VAT'], 'liability','asset', 10),
  ('EG', NULL, 'VAT', 'VAT (14%)', 14.000, 'both', true, false, false,
    ARRAY['^VAT.*Payable'], ARRAY['^VAT.*Receivable','^Input VAT'], 'liability','asset', 10),
  ('MA', NULL, 'VAT', 'VAT (20%)', 20.000, 'both', true, false, false,
    ARRAY['^VAT.*Payable'], ARRAY['^VAT.*Receivable','^Input VAT'], 'liability','asset', 10),
  ('GH', NULL, 'VAT', 'VAT (15%)', 15.000, 'both', true, false, false,
    ARRAY['^VAT.*Payable'], ARRAY['^VAT.*Receivable','^Input VAT'], 'liability','asset', 10),
  ('KE', NULL, 'VAT', 'VAT (16%)', 16.000, 'both', true, false, false,
    ARRAY['^VAT.*Payable'], ARRAY['^VAT.*Receivable','^Input VAT'], 'liability','asset', 10),
  ('TZ', NULL, 'VAT', 'VAT (18%)', 18.000, 'both', true, false, false,
    ARRAY['^VAT.*Payable'], ARRAY['^VAT.*Receivable','^Input VAT'], 'liability','asset', 10),
  ('UG', NULL, 'VAT', 'VAT (18%)', 18.000, 'both', true, false, false,
    ARRAY['^VAT.*Payable'], ARRAY['^VAT.*Receivable','^Input VAT'], 'liability','asset', 10),
  ('RW', NULL, 'VAT', 'VAT (18%)', 18.000, 'both', true, false, false,
    ARRAY['^VAT.*Payable'], ARRAY['^VAT.*Receivable','^Input VAT'], 'liability','asset', 10),
  ('ET', NULL, 'VAT', 'VAT (15%)', 15.000, 'both', true, false, false,
    ARRAY['^VAT.*Payable'], ARRAY['^VAT.*Receivable','^Input VAT'], 'liability','asset', 10),
  ('ZM', NULL, 'VAT', 'VAT (16%)', 16.000, 'both', true, false, false,
    ARRAY['^VAT.*Payable'], ARRAY['^VAT.*Receivable','^Input VAT'], 'liability','asset', 10),
  ('BI', NULL, 'VAT', 'VAT (18%)', 18.000, 'both', true, false, false,
    ARRAY['^VAT.*Payable'], ARRAY['^VAT.*Receivable','^Input VAT'], 'liability','asset', 10),
  ('MX', NULL, 'IVA', 'IVA (16%)', 16.000, 'both', true, false, false,
    ARRAY['^IVA.*Trasladado','^IVA.*Payable'], ARRAY['^IVA.*Acreditable','^IVA.*Receivable'], 'liability','asset', 10),
  ('AR', NULL, 'IVA', 'IVA (21%)', 21.000, 'both', true, false, false,
    ARRAY['^IVA.*Débito','^IVA.*Payable'], ARRAY['^IVA.*Crédito','^IVA.*Receivable'], 'liability','asset', 10),
  ('BR', NULL, 'ICMS', 'ICMS (18%)', 18.000, 'both', true, false, false,
    ARRAY['^ICMS.*Payable'], ARRAY['^ICMS.*Receivable'], 'liability','asset', 10),
  ('CL', NULL, 'IVA', 'IVA (19%)', 19.000, 'both', true, false, false,
    ARRAY['^IVA.*Débito','^IVA.*Payable'], ARRAY['^IVA.*Crédito','^IVA.*Receivable'], 'liability','asset', 10),
  ('CO', NULL, 'IVA', 'IVA (19%)', 19.000, 'both', true, false, false,
    ARRAY['^IVA.*Payable'], ARRAY['^IVA.*Receivable'], 'liability','asset', 10),
  ('PE', NULL, 'IGV', 'IGV (18%)', 18.000, 'both', true, false, false,
    ARRAY['^IGV.*Payable'], ARRAY['^IGV.*Receivable'], 'liability','asset', 10),
  ('JP', NULL, 'CT', 'Consumption Tax (10%)', 10.000, 'both', true, false, false,
    ARRAY['^Consumption Tax.*Payable'], ARRAY['^Consumption Tax.*Receivable'], 'liability','asset', 10),
  ('KR', NULL, 'VAT', 'VAT (10%)', 10.000, 'both', true, false, false,
    ARRAY['^VAT.*Payable'], ARRAY['^VAT.*Receivable','^Input VAT'], 'liability','asset', 10),
  ('CN', NULL, 'VAT', 'VAT (13%)', 13.000, 'both', true, false, false,
    ARRAY['^VAT.*Payable'], ARRAY['^VAT.*Receivable','^Input VAT'], 'liability','asset', 10),
  ('HK', NULL, 'EXEMPT', 'No Sales Tax', 0, 'both', false, false, true, '{}','{}','liability','asset', 95),
  ('SG', NULL, 'GST', 'GST (9%)', 9.000, 'both', true, false, false,
    ARRAY['^GST.*Payable','^Output GST'], ARRAY['^GST.*Receivable','^Input GST'], 'liability','asset', 10),
  ('MY', NULL, 'SST', 'SST (6%)', 6.000, 'both', false, false, false,
    ARRAY['^SST.*Payable','^Sales Tax.*Payable'], ARRAY['^SST.*Paid','^Service Tax.*Paid'], 'liability','expense', 10),
  ('TH', NULL, 'VAT', 'VAT (7%)', 7.000, 'both', true, false, false,
    ARRAY['^VAT.*Payable','^Output VAT'], ARRAY['^VAT.*Receivable','^Input VAT'], 'liability','asset', 10),
  ('ID', NULL, 'PPN', 'PPN (11%)', 11.000, 'both', true, false, false,
    ARRAY['^PPN.*Keluaran','^PPN.*Payable'], ARRAY['^PPN.*Masukan','^PPN.*Receivable'], 'liability','asset', 10),
  ('PH', NULL, 'VAT', 'VAT (12%)', 12.000, 'both', true, false, false,
    ARRAY['^VAT.*Payable','^Output VAT'], ARRAY['^VAT.*Receivable','^Input VAT'], 'liability','asset', 10),
  ('VN', NULL, 'VAT', 'VAT (10%)', 10.000, 'both', true, false, false,
    ARRAY['^VAT.*Payable','^Output VAT'], ARRAY['^VAT.*Receivable','^Input VAT'], 'liability','asset', 10),
  ('PK', NULL, 'GST', 'GST (18%)', 18.000, 'both', true, false, false,
    ARRAY['^GST.*Payable','^Sales Tax.*Payable'], ARRAY['^GST.*Receivable','^Input Tax'], 'liability','asset', 10),
  ('BD', NULL, 'VAT', 'VAT (15%)', 15.000, 'both', true, false, false,
    ARRAY['^VAT.*Payable'], ARRAY['^VAT.*Receivable'], 'liability','asset', 10),
  ('LK', NULL, 'VAT', 'VAT (18%)', 18.000, 'both', true, false, false,
    ARRAY['^VAT.*Payable'], ARRAY['^VAT.*Receivable'], 'liability','asset', 10),
  ('NP', NULL, 'VAT', 'VAT (13%)', 13.000, 'both', true, false, false,
    ARRAY['^VAT.*Payable'], ARRAY['^VAT.*Receivable'], 'liability','asset', 10),
  ('DE', NULL, 'VAT_STD', 'USt Standard (19%)', 19.000, 'both', true, false, false,
    ARRAY['^VAT.*Payable','^USt.*Payable','^Output VAT'], ARRAY['^VAT.*Receivable','^Vorsteuer','^Input VAT'], 'liability','asset', 10),
  ('FR', NULL, 'VAT_STD', 'TVA Standard (20%)', 20.000, 'both', true, false, false,
    ARRAY['^TVA.*Collectée','^VAT.*Payable'], ARRAY['^TVA.*Déductible','^VAT.*Receivable'], 'liability','asset', 10),
  ('IT', NULL, 'VAT_STD', 'IVA Standard (22%)', 22.000, 'both', true, false, false,
    ARRAY['^IVA.*Vendite','^VAT.*Payable'], ARRAY['^IVA.*Acquisti','^VAT.*Receivable'], 'liability','asset', 10),
  ('ES', NULL, 'VAT_STD', 'IVA Standard (21%)', 21.000, 'both', true, false, false,
    ARRAY['^IVA.*Repercutido','^VAT.*Payable'], ARRAY['^IVA.*Soportado','^VAT.*Receivable'], 'liability','asset', 10),
  ('PT', NULL, 'VAT_STD', 'IVA Standard (23%)', 23.000, 'both', true, false, false,
    ARRAY['^IVA.*Payable','^VAT.*Payable'], ARRAY['^IVA.*Receivable','^VAT.*Receivable'], 'liability','asset', 10),
  ('NL', NULL, 'VAT_STD', 'BTW Standard (21%)', 21.000, 'both', true, false, false,
    ARRAY['^BTW.*Payable','^VAT.*Payable'], ARRAY['^BTW.*Receivable','^VAT.*Receivable'], 'liability','asset', 10),
  ('BE', NULL, 'VAT_STD', 'TVA Standard (21%)', 21.000, 'both', true, false, false,
    ARRAY['^TVA.*Payable','^VAT.*Payable'], ARRAY['^TVA.*Receivable','^VAT.*Receivable'], 'liability','asset', 10),
  ('AT', NULL, 'VAT_STD', 'USt Standard (20%)', 20.000, 'both', true, false, false,
    ARRAY['^USt.*Payable','^VAT.*Payable'], ARRAY['^Vorsteuer','^VAT.*Receivable'], 'liability','asset', 10),
  ('CH', NULL, 'VAT_STD', 'MwSt Standard (8.1%)', 8.100, 'both', true, false, false,
    ARRAY['^MwSt.*Payable','^VAT.*Payable'], ARRAY['^MwSt.*Receivable','^VAT.*Receivable'], 'liability','asset', 10),
  ('IE', NULL, 'VAT_STD', 'VAT Standard (23%)', 23.000, 'both', true, false, false,
    ARRAY['^VAT.*Payable'], ARRAY['^VAT.*Receivable'], 'liability','asset', 10),
  ('PL', NULL, 'VAT_STD', 'VAT Standard (23%)', 23.000, 'both', true, false, false,
    ARRAY['^VAT.*Payable'], ARRAY['^VAT.*Receivable'], 'liability','asset', 10),
  ('CZ', NULL, 'VAT_STD', 'VAT Standard (21%)', 21.000, 'both', true, false, false,
    ARRAY['^VAT.*Payable','^DPH.*Payable'], ARRAY['^VAT.*Receivable','^DPH.*Receivable'], 'liability','asset', 10),
  ('SE', NULL, 'VAT_STD', 'Moms Standard (25%)', 25.000, 'both', true, false, false,
    ARRAY['^Moms.*Payable','^VAT.*Payable'], ARRAY['^Moms.*Receivable','^VAT.*Receivable'], 'liability','asset', 10),
  ('NO', NULL, 'VAT_STD', 'MVA Standard (25%)', 25.000, 'both', true, false, false,
    ARRAY['^MVA.*Payable','^VAT.*Payable'], ARRAY['^MVA.*Receivable','^VAT.*Receivable'], 'liability','asset', 10),
  ('DK', NULL, 'VAT_STD', 'Moms Standard (25%)', 25.000, 'both', true, false, false,
    ARRAY['^Moms.*Payable','^VAT.*Payable'], ARRAY['^Moms.*Receivable','^VAT.*Receivable'], 'liability','asset', 10),
  ('FI', NULL, 'VAT_STD', 'ALV Standard (25.5%)', 25.500, 'both', true, false, false,
    ARRAY['^ALV.*Payable','^VAT.*Payable'], ARRAY['^ALV.*Receivable','^VAT.*Receivable'], 'liability','asset', 10),
  ('TR', NULL, 'KDV', 'KDV Standard (20%)', 20.000, 'both', true, false, false,
    ARRAY['^KDV.*Payable'], ARRAY['^KDV.*Receivable'], 'liability','asset', 10),
  ('RO', NULL, 'VAT_STD', 'TVA Standard (19%)', 19.000, 'both', true, false, false,
    ARRAY['^TVA.*Payable','^VAT.*Payable'], ARRAY['^TVA.*Receivable','^VAT.*Receivable'], 'liability','asset', 10),
  ('HU', NULL, 'VAT_STD', 'ÁFA Standard (27%)', 27.000, 'both', true, false, false,
    ARRAY['^ÁFA.*Payable','^VAT.*Payable'], ARRAY['^ÁFA.*Receivable','^VAT.*Receivable'], 'liability','asset', 10),
  ('GR', NULL, 'VAT_STD', 'VAT Standard (24%)', 24.000, 'both', true, false, false,
    ARRAY['^VAT.*Payable'], ARRAY['^VAT.*Receivable'], 'liability','asset', 10),
  ('HR', NULL, 'VAT_STD', 'PDV Standard (25%)', 25.000, 'both', true, false, false,
    ARRAY['^PDV.*Payable','^VAT.*Payable'], ARRAY['^PDV.*Receivable','^VAT.*Receivable'], 'liability','asset', 10),
  ('UA', NULL, 'VAT_STD', 'VAT Standard (20%)', 20.000, 'both', true, false, false,
    ARRAY['^VAT.*Payable'], ARRAY['^VAT.*Receivable'], 'liability','asset', 10)
ON CONFLICT (country_code, COALESCE(jurisdiction_code,''), code) DO UPDATE SET
  name = EXCLUDED.name, rate = EXCLUDED.rate,
  collected_account_patterns = EXCLUDED.collected_account_patterns,
  paid_account_patterns = EXCLUDED.paid_account_patterns,
  updated_at = now();

CREATE OR REPLACE FUNCTION public.resolve_tax_gl_account(
  _org_id uuid, _account_type text, _patterns text[]
) RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _account_id uuid; _pattern text;
BEGIN
  IF _patterns IS NULL OR array_length(_patterns, 1) IS NULL THEN RETURN NULL; END IF;
  FOREACH _pattern IN ARRAY _patterns LOOP
    SELECT id INTO _account_id FROM public.accounts
     WHERE organization_id = _org_id
       AND account_type::text = _account_type
       AND name ~* _pattern
     ORDER BY code LIMIT 1;
    IF _account_id IS NOT NULL THEN RETURN _account_id; END IF;
  END LOOP;
  RETURN NULL;
END;
$$;

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
      gl_collected_account_id, gl_paid_account_id, effective_date
    ) VALUES (
      _org_id, _seed.code, _seed.name, _seed.rate, _country_code, _seed.tax_type,
      _seed.is_recoverable, _seed.is_compound, true, _seed.is_zero_rated, _seed.is_exempt,
      public.resolve_tax_gl_account(_org_id, _seed.collected_account_type, _seed.collected_account_patterns),
      public.resolve_tax_gl_account(_org_id, _seed.paid_account_type,      _seed.paid_account_patterns),
      CURRENT_DATE
    )
    ON CONFLICT (organization_id, code) DO UPDATE SET
      gl_collected_account_id = COALESCE(public.tax_codes.gl_collected_account_id, EXCLUDED.gl_collected_account_id),
      gl_paid_account_id      = COALESCE(public.tax_codes.gl_paid_account_id,      EXCLUDED.gl_paid_account_id),
      updated_at = now();
    _inserted := _inserted + 1;
  END LOOP;
  RETURN _inserted;
END;
$$;

CREATE OR REPLACE FUNCTION public.relink_organization_tax_codes(_org_id uuid)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _country_code text; _province text; _updated int := 0; _seed RECORD;
        _new_collected uuid; _new_paid uuid; _step int;
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
  LOOP
    _new_collected := public.resolve_tax_gl_account(_org_id, _seed.collected_account_type, _seed.collected_account_patterns);
    _new_paid      := public.resolve_tax_gl_account(_org_id, _seed.paid_account_type,      _seed.paid_account_patterns);

    UPDATE public.tax_codes
       SET gl_collected_account_id = COALESCE(gl_collected_account_id, _new_collected),
           gl_paid_account_id      = COALESCE(gl_paid_account_id,      _new_paid),
           updated_at = now()
     WHERE organization_id = _org_id
       AND code = _seed.code
       AND (gl_collected_account_id IS NULL OR gl_paid_account_id IS NULL);
    GET DIAGNOSTICS _step = ROW_COUNT;
    _updated := _updated + _step;
  END LOOP;
  RETURN _updated;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_seed_org_tax_codes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  BEGIN PERFORM public.seed_organization_tax_codes(NEW.id);
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'trg_seed_org_tax_codes failed for %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS seed_tax_codes_on_org_create ON public.organizations;
CREATE TRIGGER seed_tax_codes_on_org_create
  AFTER INSERT ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.trg_seed_org_tax_codes();

CREATE OR REPLACE FUNCTION public.trg_relink_tax_codes_on_account()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  BEGIN PERFORM public.relink_organization_tax_codes(NEW.organization_id);
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'trg_relink_tax_codes_on_account failed for %: %', NEW.organization_id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS relink_tax_codes_on_account_change ON public.accounts;
CREATE TRIGGER relink_tax_codes_on_account_change
  AFTER INSERT OR UPDATE OF name, account_type ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.trg_relink_tax_codes_on_account();

DO $$
DECLARE _org RECORD;
BEGIN
  FOR _org IN SELECT id FROM public.organizations LOOP
    PERFORM public.seed_organization_tax_codes(_org.id);
    PERFORM public.relink_organization_tax_codes(_org.id);
  END LOOP;
END $$;
