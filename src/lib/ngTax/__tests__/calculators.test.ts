import { describe, expect, it } from 'vitest';
import {
  calculatePaye,
  calculatePercentageOnBase,
  calculateVat,
  calculateWht,
  calculateCit,
} from '../calculators';
import type { NgServiceClassification, NgTaxRelief } from '../types';
import type { ResolvedTax } from '../resolver';

const vatResolved: ResolvedTax = {
  definition: {
    id: 'd1', organization_id: null, code: 'NG-VAT', name: 'VAT',
    tax_category: 'sales', jurisdiction_level: 'federal', jurisdiction_code: 'NG',
    filing_frequency: 'monthly', remittance_due_offset_days: 21,
    default_debit_account_code: 'D', default_credit_account_code: 'C', is_active: true,
  },
  version: {
    id: 'v1', definition_id: 'd1', effective_from: '2020-02-01', effective_to: null,
    calculation_method: 'percentage', rate: 7.5, brackets: [], formula: {},
    min_threshold: null, max_cap: null, source_reference: 'Finance Act 2020',
  },
};

describe('NG VAT', () => {
  it('adds 7.5% on net', () => {
    const r = calculateVat(vatResolved, 1000);
    expect(r.tax_amount).toBe(75);
    expect(r.tax_rate).toBe(7.5);
  });
  it('extracts VAT when inclusive', () => {
    const r = calculateVat(vatResolved, 1075, true);
    expect(r.taxable_base).toBeCloseTo(1000, 2);
    expect(r.tax_amount).toBeCloseTo(75, 2);
  });
});

const payeResolved: ResolvedTax = {
  definition: { ...vatResolved.definition, id: 'p', code: 'NG-PAYE', tax_category: 'payroll' },
  version: {
    id: 'pv', definition_id: 'p', effective_from: '2023-01-01', effective_to: null,
    calculation_method: 'progressive', rate: null,
    brackets: [
      { min: 0, max: 300000, rate: 7 },
      { min: 300000, max: 600000, rate: 11 },
      { min: 600000, max: 1100000, rate: 15 },
      { min: 1100000, max: 1600000, rate: 19 },
      { min: 1600000, max: 3200000, rate: 21 },
      { min: 3200000, max: null, rate: 24 },
    ],
    formula: {}, min_threshold: null, max_cap: null, source_reference: 'PITA',
  },
};

const reliefs: NgTaxRelief[] = [
  {
    id: 'r1', code: 'CRA', name: 'CRA', relief_type: 'cra', effective_from: '2020-01-13', effective_to: null,
    formula: { higher_of: [200000, { op: 'mul', args: ['gross', 0.01] }], plus: { op: 'mul', args: ['gross', 0.20] } },
  },
  { id: 'r2', code: 'PEN', name: 'Pension', relief_type: 'pension', effective_from: '2014-07-01', effective_to: null, formula: { actual: 'pension_employee' } },
];

describe('NG PAYE', () => {
  it('applies CRA + pension relief, then progressive brackets', () => {
    const r = calculatePaye(
      payeResolved,
      { annualGross: 3000000, pensionEmployee: 240000, nhfEmployee: 0, nhisEmployee: 0, periodsPerYear: 12 },
      reliefs,
    );
    // CRA = max(200k, 30k) + 20% of 3M = 200k + 600k = 800k. Plus pension 240k = 1,040,000
    // Taxable = 3,000,000 - 1,040,000 = 1,960,000
    // 300k@7=21k + 300k@11=33k + 500k@15=75k + 500k@19=95k + 360k@21=75,600 = 299,600
    expect(r.taxable_base).toBeCloseTo(1_960_000, 0);
    expect(r.breakdown.inputs.annual_tax).toBeCloseTo(299_600, 0);
    expect(r.tax_amount).toBeCloseTo(299_600 / 12, 1);
  });
});

describe('NG Pension percentage-on-base', () => {
  const pensionResolved: ResolvedTax = {
    definition: { ...vatResolved.definition, id: 'pe', code: 'NG-PENSION-EE', tax_category: 'payroll' },
    version: { ...vatResolved.version, id: 'pev', definition_id: 'pe', rate: 8, source_reference: 'PRA 2014' },
  };
  it('8% of basic+housing+transport', () => {
    const r = calculatePercentageOnBase(pensionResolved, 200000);
    expect(r.tax_amount).toBe(16000);
  });
});

describe('NG WHT', () => {
  const whtResolved: ResolvedTax = {
    definition: { ...vatResolved.definition, id: 'w', code: 'NG-WHT', tax_category: 'withholding' },
    version: { ...vatResolved.version, id: 'wv', definition_id: 'w', rate: 10 },
  };
  const constr: NgServiceClassification = {
    id: 'c1', code: 'WHT-CONSTR', name: 'Construction', definition_id: 'w',
    resident_rate: 2.5, non_resident_rate: 5, min_threshold: 10000,
    effective_from: '2023-01-01', effective_to: null,
  };
  it('resident 2.5% on construction', () => {
    const r = calculateWht(whtResolved, constr, 1_000_000);
    expect(r.tax_amount).toBe(25000);
  });
  it('non-resident 5%', () => {
    const r = calculateWht(whtResolved, constr, 1_000_000, { isNonResident: true });
    expect(r.tax_amount).toBe(50000);
  });
  it('below threshold — no WHT', () => {
    const r = calculateWht(whtResolved, constr, 5000);
    expect(r.tax_amount).toBe(0);
  });
});

describe('NG CIT tiered by turnover', () => {
  const citResolved: ResolvedTax = {
    definition: { ...vatResolved.definition, id: 'c', code: 'NG-CIT', tax_category: 'corporate' },
    version: {
      ...vatResolved.version, id: 'cv', definition_id: 'c', calculation_method: 'tiered_turnover',
      rate: null,
      brackets: [
        { min: 0, max: 25_000_000, rate: 0 },
        { min: 25_000_000, max: 100_000_000, rate: 20 },
        { min: 100_000_000, max: null, rate: 30 },
      ],
    },
  };
  it('small company (turnover ≤ 25M) — 0%', () => {
    expect(calculateCit(citResolved, { turnover: 20_000_000, assessableProfit: 5_000_000 }).tax_amount).toBe(0);
  });
  it('medium (25M–100M) — 20%', () => {
    expect(calculateCit(citResolved, { turnover: 50_000_000, assessableProfit: 10_000_000 }).tax_amount).toBe(2_000_000);
  });
  it('large (> 100M) — 30%', () => {
    expect(calculateCit(citResolved, { turnover: 500_000_000, assessableProfit: 50_000_000 }).tax_amount).toBe(15_000_000);
  });
});
