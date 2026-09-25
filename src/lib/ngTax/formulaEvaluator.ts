/**
 * Safe evaluator for the small JSON DSL used in `ng_tax_rate_versions.formula`
 * and `ng_tax_reliefs.formula`.
 *
 * Grammar
 *   Node = number | string(variable name) | { op: "add"|"sub"|"mul"|"div"|"min"|"max", args: Node[] }
 *        | { higher_of: Node[] }
 *        | { plus: Node }                           // chained additive term
 *        | { actual: string }                       // pass-through variable
 *        | { bracket_lookup: { brackets, value } }
 *
 * The evaluator is intentionally tiny: no function calls, no property access,
 * no eval. It never touches globals.
 */

import type { NgTaxBracket } from './types';

export type FormulaVars = Record<string, number>;

export function evaluateFormula(node: unknown, vars: FormulaVars): number {
  if (typeof node === 'number') return node;
  if (typeof node === 'string') return vars[node] ?? 0;
  if (!node || typeof node !== 'object') return 0;
  const obj = node as Record<string, unknown>;

  if ('op' in obj && Array.isArray(obj.args)) {
    const args = (obj.args as unknown[]).map((a) => evaluateFormula(a, vars));
    switch (obj.op) {
      case 'add':
        return args.reduce((a, b) => a + b, 0);
      case 'sub':
        return args.reduce((a, b, i) => (i === 0 ? b : a - b), 0);
      case 'mul':
        return args.reduce((a, b) => a * b, 1);
      case 'div':
        return args[1] === 0 ? 0 : args[0] / args[1];
      case 'min':
        return Math.min(...args);
      case 'max':
        return Math.max(...args);
    }
  }

  if ('higher_of' in obj && Array.isArray(obj.higher_of)) {
    const vals = (obj.higher_of as unknown[]).map((a) => evaluateFormula(a, vars));
    let total = Math.max(...vals);
    if ('plus' in obj) total += evaluateFormula(obj.plus, vars);
    return total;
  }

  if ('lower_of' in obj && Array.isArray(obj.lower_of)) {
    const vals = (obj.lower_of as unknown[]).map((a) => evaluateFormula(a, vars));
    return Math.min(...vals);
  }

  if ('actual' in obj && typeof obj.actual === 'string') {
    return vars[obj.actual] ?? 0;
  }

  return 0;
}

/**
 * Compute tax due on a progressive bracket set (used for PAYE).
 */
export function computeProgressive(taxableAmount: number, brackets: NgTaxBracket[]): {
  tax: number;
  perBracket: Array<{ min: number; max: number | null; rate: number; taxed: number; tax: number }>;
} {
  const perBracket: Array<{ min: number; max: number | null; rate: number; taxed: number; tax: number }> = [];
  let remaining = taxableAmount;
  let tax = 0;
  const sorted = [...brackets].sort((a, b) => a.min - b.min);
  for (const b of sorted) {
    if (remaining <= 0) break;
    const size = b.max == null ? remaining : Math.max(0, b.max - b.min);
    const taxed = Math.min(remaining, size);
    const bTax = taxed * (b.rate / 100);
    tax += bTax;
    perBracket.push({ min: b.min, max: b.max, rate: b.rate, taxed, tax: bTax });
    remaining -= taxed;
  }
  return { tax: round2(tax), perBracket };
}

/**
 * Find the applicable turnover tier (used for CIT).
 */
export function computeTieredTurnover(turnover: number, brackets: NgTaxBracket[]): {
  rate: number;
  tier: NgTaxBracket | null;
} {
  const sorted = [...brackets].sort((a, b) => a.min - b.min);
  const tier = sorted.find((b) => turnover >= b.min && (b.max == null || turnover < b.max)) ?? null;
  return { rate: tier?.rate ?? 0, tier };
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
