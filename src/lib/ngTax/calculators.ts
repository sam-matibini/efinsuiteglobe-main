/**
 * Nigerian tax calculators — one function per tax type. Each is a pure
 * function of the resolved rate version + inputs; there are NO hard-coded
 * rates in this file.
 */

import { computeProgressive, computeTieredTurnover, evaluateFormula, round2 } from './formulaEvaluator';
import type {
  NgCalculationResult,
  NgServiceClassification,
  NgTaxRelief,
} from './types';
import type { ResolvedTax } from './resolver';

function makeResult(
  resolved: ResolvedTax,
  taxableBase: number,
  taxAmount: number,
  rate: number | null,
  breakdown: NgCalculationResult['breakdown'],
  currency = 'NGN',
): NgCalculationResult {
  return {
    definition_code: resolved.definition.code,
    definition_id: resolved.definition.id,
    rate_version_id: resolved.version.id,
    taxable_base: round2(taxableBase),
    tax_rate: rate,
    tax_amount: round2(taxAmount),
    currency,
    breakdown,
    journal_template: {
      debit_account_code: resolved.definition.default_debit_account_code,
      credit_account_code: resolved.definition.default_credit_account_code,
      amount: round2(taxAmount),
      memo: `${resolved.definition.name} @ ${rate ?? 'progressive'}%`,
    },
  };
}

/**
 * VAT — flat percentage on a net taxable base.
 */
export function calculateVat(
  resolved: ResolvedTax,
  netAmount: number,
  isInclusive = false,
): NgCalculationResult {
  const rate = Number(resolved.version.rate ?? 0);
  const base = isInclusive ? netAmount / (1 + rate / 100) : netAmount;
  const tax = base * (rate / 100);
  return makeResult(resolved, base, tax, rate, {
    formula_used: 'base * rate%',
    inputs: { net: netAmount, rate, base },
    steps: [
      { label: isInclusive ? 'Extracted base' : 'Base', value: round2(base) },
      { label: `VAT @ ${rate}%`, value: round2(tax) },
    ],
    source_reference: resolved.version.source_reference,
  });
}

/**
 * WHT — resident vs non-resident rate, minimum-threshold guard.
 */
export function calculateWht(
  resolved: ResolvedTax,
  classification: NgServiceClassification,
  amount: number,
  opts: { isNonResident?: boolean } = {},
): NgCalculationResult {
  const rate = opts.isNonResident
    ? Number(classification.non_resident_rate ?? classification.resident_rate)
    : Number(classification.resident_rate);
  const belowThreshold =
    classification.min_threshold != null && amount < Number(classification.min_threshold);
  const tax = belowThreshold ? 0 : amount * (rate / 100);
  return makeResult(resolved, amount, tax, rate, {
    formula_used: 'amount * rate%',
    inputs: {
      amount,
      rate,
      min_threshold: Number(classification.min_threshold ?? 0),
    },
    steps: belowThreshold
      ? [{ label: `Below ₦${classification.min_threshold} threshold — no WHT`, value: 0 }]
      : [{ label: `WHT ${classification.code} @ ${rate}%`, value: round2(tax) }],
    source_reference: resolved.version.source_reference,
  });
}

/**
 * PAYE — computes annual tax on Consolidated Relief-adjusted income, then
 * spreads across the pay period.
 */
export function calculatePaye(
  resolved: ResolvedTax,
  input: {
    annualGross: number;
    pensionEmployee: number;
    nhfEmployee: number;
    nhisEmployee: number;
    lifeAssurancePremium?: number;
    periodsPerYear: number;
  },
  reliefs: NgTaxRelief[],
): NgCalculationResult {
  const vars = {
    gross: input.annualGross,
    pension_employee: input.pensionEmployee,
    nhf_employee: input.nhfEmployee,
    nhis_employee: input.nhisEmployee,
    life_assurance_premium: input.lifeAssurancePremium ?? 0,
  };
  let totalRelief = 0;
  const reliefSteps: Array<{ label: string; value: number }> = [];
  for (const r of reliefs) {
    const v = evaluateFormula(r.formula, vars);
    totalRelief += v;
    reliefSteps.push({ label: `${r.name}`, value: round2(v) });
  }
  const taxableAnnual = Math.max(0, input.annualGross - totalRelief);
  const { tax: annualTax, perBracket } = computeProgressive(
    taxableAnnual,
    resolved.version.brackets,
  );
  const periodTax = annualTax / input.periodsPerYear;
  return makeResult(resolved, taxableAnnual, periodTax, null, {
    formula_used: 'progressive(annual_gross - Σ reliefs) / periods',
    inputs: {
      annual_gross: input.annualGross,
      total_relief: round2(totalRelief),
      taxable_annual: round2(taxableAnnual),
      annual_tax: round2(annualTax),
      periods_per_year: input.periodsPerYear,
    },
    steps: [
      ...reliefSteps,
      { label: 'Taxable annual', value: round2(taxableAnnual) },
      ...perBracket.map((b) => ({
        label: `Bracket ₦${b.min}-${b.max ?? '∞'} @ ${b.rate}%`,
        value: round2(b.tax),
      })),
      { label: 'Annual PAYE', value: round2(annualTax) },
      { label: `Period PAYE (÷${input.periodsPerYear})`, value: round2(periodTax) },
    ],
    source_reference: resolved.version.source_reference,
  });
}

/**
 * Percentage-on-base tax (Pension, NHF, NSITF, ITF, TET, NHIS).
 * `base` should be pre-computed (e.g. basic+housing+transport for pension).
 */
export function calculatePercentageOnBase(
  resolved: ResolvedTax,
  base: number,
): NgCalculationResult {
  const rate = Number(resolved.version.rate ?? 0);
  const tax = base * (rate / 100);
  return makeResult(resolved, base, tax, rate, {
    formula_used: 'base * rate%',
    inputs: { base, rate },
    steps: [{ label: `${resolved.definition.name} @ ${rate}%`, value: round2(tax) }],
    source_reference: resolved.version.source_reference,
  });
}

/**
 * CIT — turnover tier selects the rate, applied to assessable profit.
 */
export function calculateCit(
  resolved: ResolvedTax,
  input: { turnover: number; assessableProfit: number },
): NgCalculationResult {
  const { rate, tier } = computeTieredTurnover(input.turnover, resolved.version.brackets);
  const tax = Math.max(0, input.assessableProfit) * (rate / 100);
  return makeResult(resolved, input.assessableProfit, tax, rate, {
    formula_used: 'assessable_profit * tier_rate%',
    inputs: {
      turnover: input.turnover,
      assessable_profit: input.assessableProfit,
      rate,
    },
    steps: [
      {
        label: `Turnover tier ₦${tier?.min ?? 0}-${tier?.max ?? '∞'} → ${rate}%`,
        value: rate,
      },
      { label: 'CIT', value: round2(tax) },
    ],
    source_reference: resolved.version.source_reference,
  });
}
