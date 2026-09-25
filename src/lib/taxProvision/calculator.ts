// Phase 14: Tax Provision Calculator (ASC 740 / IAS 12)
// All amounts in INTEGER CENTS — see .lovable/memory: integer-cent arithmetic.

import type {
  TempDiffMovement,
  TemporaryDifference,
  ProvisionAdjustment,
  ProvisionComputation,
} from './types';

const c = (n: number) => Math.round(n);

export interface ComputeProvisionInput {
  pretaxBookIncomeCents: number;
  blendedStatutoryRate: number; // e.g. 0.265 = 26.5%
  movements: Array<{ movement: TempDiffMovement; tempDiff: TemporaryDifference }>;
  adjustments: ProvisionAdjustment[];
  nolUsedCents?: number;
}

/**
 * Compute current and deferred tax under ASC 740 / IAS 12.
 *
 * Current tax = Taxable income × statutory rate
 *   Taxable income = Book income
 *     + permanent diffs
 *     + reversing taxable temp diffs (added back, since they were never on books)
 *     - originating taxable temp diffs (deducted now, taxed later)
 *     - reversing deductible temp diffs (deducted now in books, was added earlier)
 *     + originating deductible temp diffs (added back, will be deducted later)
 *     - NOL utilized
 *
 * Deferred tax expense = Σ (movement in deferred tax balances)
 *   = Σ (closing DTL/DTA - opening DTL/DTA), signed by direction.
 */
export function computeProvision(input: ComputeProvisionInput): ProvisionComputation {
  const {
    pretaxBookIncomeCents,
    blendedStatutoryRate,
    movements,
    adjustments,
    nolUsedCents = 0,
  } = input;

  let taxableTempOriginating = 0;
  let taxableTempReversing = 0;
  let deductibleTempOriginating = 0;
  let deductibleTempReversing = 0;
  let deferredTaxMovement = 0;

  for (const { movement, tempDiff } of movements) {
    if (tempDiff.difference_type === 'taxable') {
      taxableTempOriginating += movement.originating_cents;
      taxableTempReversing += movement.reversing_cents;
    } else {
      deductibleTempOriginating += movement.originating_cents;
      deductibleTempReversing += movement.reversing_cents;
    }
    // Deferred tax movement: change in DT balance.
    // Taxable diff -> DTL (expense when increases). Deductible -> DTA (benefit when increases).
    const sign = tempDiff.difference_type === 'taxable' ? 1 : -1;
    deferredTaxMovement += sign * movement.deferred_tax_movement_cents;
  }

  const permanentDiffs = adjustments
    .filter((a) => a.adjustment_type === 'permanent_difference')
    .reduce((s, a) => s + a.amount_cents, 0);

  const discreteImpacts = adjustments
    .filter((a) => a.adjustment_type !== 'permanent_difference')
    .reduce((s, a) => s + a.tax_impact_cents, 0);

  const taxableIncome = c(
    pretaxBookIncomeCents +
      permanentDiffs -
      taxableTempOriginating +
      taxableTempReversing +
      deductibleTempOriginating -
      deductibleTempReversing -
      nolUsedCents
  );

  const currentTax = c(taxableIncome * blendedStatutoryRate);
  const deferredTax = c(deferredTaxMovement);
  const totalProvision = c(currentTax + deferredTax + discreteImpacts);
  const effectiveTaxRate =
    pretaxBookIncomeCents !== 0 ? totalProvision / pretaxBookIncomeCents : 0;

  return {
    pretaxBookIncome: pretaxBookIncomeCents,
    permanentDiffs,
    taxableTempOriginating,
    taxableTempReversing,
    deductibleTempOriginating,
    deductibleTempReversing,
    taxableIncome,
    blendedRate: blendedStatutoryRate,
    currentTax,
    deferredTax,
    totalProvision,
    effectiveTaxRate,
  };
}

/**
 * Build standard ETR reconciliation: statutory -> effective, line by line.
 */
export function buildEtrReconciliation(
  comp: ProvisionComputation,
  adjustments: ProvisionAdjustment[]
): Array<{ description: string; amount_cents: number; rate_pct: number; line_type: 'statutory' | 'item' | 'subtotal' | 'effective' }> {
  const pretax = comp.pretaxBookIncome;
  const pct = (n: number) => (pretax !== 0 ? (n / pretax) * 100 : 0);
  const statTax = c(pretax * comp.blendedRate);

  const lines: Array<{ description: string; amount_cents: number; rate_pct: number; line_type: 'statutory' | 'item' | 'subtotal' | 'effective' }> = [
    { description: 'Tax at statutory rate', amount_cents: statTax, rate_pct: comp.blendedRate * 100, line_type: 'statutory' },
  ];

  const permTax = c(comp.permanentDiffs * comp.blendedRate);
  if (permTax !== 0) {
    lines.push({ description: 'Permanent differences', amount_cents: permTax, rate_pct: pct(permTax), line_type: 'item' });
  }
  for (const a of adjustments.filter((x) => x.adjustment_type !== 'permanent_difference')) {
    lines.push({
      description: a.description,
      amount_cents: a.tax_impact_cents,
      rate_pct: pct(a.tax_impact_cents),
      line_type: 'item',
    });
  }
  lines.push({
    description: 'Total tax provision',
    amount_cents: comp.totalProvision,
    rate_pct: comp.effectiveTaxRate * 100,
    line_type: 'effective',
  });
  return lines;
}

function _c(n: number) { return c(n); }
