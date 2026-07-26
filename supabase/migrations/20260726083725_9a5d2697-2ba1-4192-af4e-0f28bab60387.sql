
-- 1) Rename existing NG template to IFRS for SMEs
UPDATE public.coa_templates
SET name = 'Nigeria — IFRS for SMEs',
    description = 'Nigerian Chart of Accounts aligned with IFRS for SMEs (Sections 27/29 simplifications, single deferred tax, no FVOCI)',
    accounting_standard = 'IFRS for SMEs',
    is_default = true
WHERE id = 'beea3fec-1ffb-464b-8cd8-a72308ab89ce';

-- 2) Create Nigeria — Full IFRS template by cloning accounts
DO $$
DECLARE
  v_country_id uuid;
  v_new_template_id uuid := gen_random_uuid();
  v_source_template uuid := 'beea3fec-1ffb-464b-8cd8-a72308ab89ce';
BEGIN
  SELECT id INTO v_country_id FROM public.countries WHERE code = 'NG';

  INSERT INTO public.coa_templates (id, country_id, name, description, industry, accounting_standard, is_default, is_active)
  VALUES (
    v_new_template_id,
    v_country_id,
    'Nigeria — Full IFRS',
    'Nigerian Chart of Accounts aligned with Full IFRS (IAS 12 deferred tax detail, IFRS 9 FVOCI/FVTPL, IAS 40 investment property, IFRS 15 contract balances, IFRS 5 held-for-sale)',
    'General',
    'IFRS',
    false,
    true
  );

  -- Clone all existing accounts
  INSERT INTO public.coa_template_accounts (
    template_id, code, name, account_type, account_group, account_sub_group,
    parent_code, is_header, is_tax_account, is_payroll_account,
    tax_type_code, deduction_type_code, normal_balance, description, sort_order
  )
  SELECT
    v_new_template_id, code, name, account_type, account_group, account_sub_group,
    parent_code, is_header, is_tax_account, is_payroll_account,
    tax_type_code, deduction_type_code, normal_balance, description, sort_order
  FROM public.coa_template_accounts
  WHERE template_id = v_source_template;

  -- Add Full-IFRS-only accounts
  INSERT INTO public.coa_template_accounts (template_id, code, name, account_type, account_group, parent_code, is_header, normal_balance, sort_order, description)
  VALUES
    (v_new_template_id, '1810', 'Investment Property (IAS 40)', 'asset', 'Non-Current Assets', '1800', false, 'debit', 810, 'Property held to earn rentals or capital appreciation, measured at fair value'),
    (v_new_template_id, '1820', 'Biological Assets (IAS 41)', 'asset', 'Non-Current Assets', '1800', false, 'debit', 820, 'Living plants/animals measured at fair value less costs to sell'),
    (v_new_template_id, '1830', 'Financial Assets — FVOCI (IFRS 9)', 'asset', 'Non-Current Assets', '1800', false, 'debit', 830, 'Debt/equity investments at fair value through OCI'),
    (v_new_template_id, '1835', 'Financial Assets — FVTPL (IFRS 9)', 'asset', 'Non-Current Assets', '1800', false, 'debit', 835, 'Financial assets at fair value through profit or loss'),
    (v_new_template_id, '1840', 'ECL Allowance — Financial Assets', 'asset', 'Non-Current Assets', '1800', false, 'credit', 840, 'Expected credit loss allowance under IFRS 9'),
    (v_new_template_id, '1850', 'Deferred Tax Asset (IAS 12)', 'asset', 'Non-Current Assets', '1800', false, 'debit', 850, 'Deferred tax asset from deductible temporary differences'),
    (v_new_template_id, '1860', 'Non-Current Assets Held for Sale (IFRS 5)', 'asset', 'Non-Current Assets', '1800', false, 'debit', 860, 'Assets classified as held for sale'),
    (v_new_template_id, '1450', 'Contract Assets (IFRS 15)', 'asset', 'Current Assets', '1100', false, 'debit', 450, 'Right to consideration in exchange for goods/services transferred'),
    (v_new_template_id, '2450', 'Contract Liabilities (IFRS 15)', 'liability', 'Current Liabilities', '2100', false, 'credit', 450, 'Obligation to transfer goods/services for consideration received'),
    (v_new_template_id, '2850', 'Deferred Tax Liability (IAS 12)', 'liability', 'Non-Current Liabilities', '2800', false, 'credit', 850, 'Deferred tax from taxable temporary differences'),
    (v_new_template_id, '3410', 'FVOCI Reserve', 'equity', 'Reserves', '3400', false, 'credit', 410, 'Cumulative gains/losses on FVOCI financial assets'),
    (v_new_template_id, '3420', 'Cash Flow Hedge Reserve', 'equity', 'Reserves', '3400', false, 'credit', 420, 'Effective portion of cash flow hedge gains/losses');
END $$;

-- 3) Security & Intelligence overlay applied to BOTH NG templates
DO $$
DECLARE
  v_template uuid;
BEGIN
  FOR v_template IN
    SELECT id FROM public.coa_templates
    WHERE country_id = (SELECT id FROM public.countries WHERE code = 'NG')
  LOOP
    INSERT INTO public.coa_template_accounts (template_id, code, name, account_type, account_group, parent_code, is_header, normal_balance, sort_order, description) VALUES
      -- Revenue
      (v_template, '4110', 'Guarding Services Revenue', 'income', 'Security & Intelligence', '4000', false, 'credit', 5110, 'Manned guarding contract revenue'),
      (v_template, '4120', 'Investigation & Intelligence Fees', 'income', 'Security & Intelligence', '4000', false, 'credit', 5120, 'Private investigation and intel service fees'),
      (v_template, '4130', 'Alarm Monitoring Revenue', 'income', 'Security & Intelligence', '4000', false, 'credit', 5130, '24/7 monitoring subscriptions'),
      (v_template, '4140', 'Escort & VIP Protection', 'income', 'Security & Intelligence', '4000', false, 'credit', 5140, 'Executive/VIP protection services'),
      (v_template, '4150', 'Cybersecurity / Threat-Intel Subscriptions', 'income', 'Security & Intelligence', '4000', false, 'credit', 5150, 'Cyber threat intelligence subscription revenue'),
      (v_template, '4160', 'Security Training Income', 'income', 'Security & Intelligence', '4000', false, 'credit', 5160, 'Guard and defensive training programs'),
      -- COGS / Direct costs
      (v_template, '5210', 'Guard Wages & Allowances', 'cogs', 'Security & Intelligence', '5000', false, 'debit', 6210, 'Direct guard payroll and hazard allowances'),
      (v_template, '5220', 'Uniforms & PPE', 'cogs', 'Security & Intelligence', '5000', false, 'debit', 6220, 'Uniforms, boots, protective equipment'),
      (v_template, '5230', 'Firearms & Ammunition', 'cogs', 'Security & Intelligence', '5000', false, 'debit', 6230, 'Consumable ammunition and firearm maintenance'),
      (v_template, '5240', 'Canine (K9) Unit Costs', 'cogs', 'Security & Intelligence', '5000', false, 'debit', 6240, 'K9 handler, feeding, veterinary costs'),
      (v_template, '5250', 'Fleet Fuel & Maintenance — Security', 'cogs', 'Security & Intelligence', '5000', false, 'debit', 6250, 'Patrol vehicle fuel, maintenance'),
      (v_template, '5260', 'Subcontracted Security', 'cogs', 'Security & Intelligence', '5000', false, 'debit', 6260, 'Third-party guarding subcontractors'),
      (v_template, '5270', 'Communications Equipment (Radios)', 'cogs', 'Security & Intelligence', '5000', false, 'debit', 6270, 'Radio airtime, comms consumables'),
      (v_template, '5280', 'Surveillance Consumables', 'cogs', 'Security & Intelligence', '5000', false, 'debit', 6280, 'CCTV/DVR consumables, storage media'),
      -- Assets
      (v_template, '1710', 'Firearms & Weapons (Regulated)', 'asset', 'Security & Intelligence', '1700', false, 'debit', 7710, 'Firearms register — regulated asset'),
      (v_template, '1720', 'Surveillance & CCTV Equipment', 'asset', 'Security & Intelligence', '1700', false, 'debit', 7720, 'CCTV, DVR, monitoring equipment'),
      (v_template, '1730', 'Armored / Patrol Vehicles', 'asset', 'Security & Intelligence', '1700', false, 'debit', 7730, 'Armored cars, patrol fleet'),
      (v_template, '1740', 'K9 Unit Assets', 'asset', 'Security & Intelligence', '1700', false, 'debit', 7740, 'Trained working dogs'),
      -- Liabilities
      (v_template, '2410', 'Client Retainer Deposits', 'liability', 'Security & Intelligence', '2100', false, 'credit', 8410, 'Advance retainers from security clients'),
      (v_template, '2420', 'Regulatory Bond Payable (NSCDC / PSGPB)', 'liability', 'Security & Intelligence', '2100', false, 'credit', 8420, 'Statutory bonds for licensed security firms'),
      -- Expenses
      (v_template, '6310', 'License & Regulatory Fees (NSCDC/DSS)', 'expense', 'Security & Intelligence', '6000', false, 'debit', 9310, 'NSCDC licensing, DSS clearances, PSGPB fees'),
      (v_template, '6320', 'Insurance — Liability & Fidelity', 'expense', 'Security & Intelligence', '6000', false, 'debit', 9320, 'Public liability, fidelity guarantee insurance'),
      (v_template, '6330', 'Background-Check & Vetting Costs', 'expense', 'Security & Intelligence', '6000', false, 'debit', 9330, 'Pre-employment background checks, vetting')
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;
