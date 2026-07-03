/**
 * FX Posting Helpers — converts foreign currency amounts to base currency,
 * computes realized & unrealized FX gain/loss using integer-cent precision.
 */

const toCents = (n: number) => Math.round(n * 100);
const fromCents = (c: number) => c / 100;

export interface FxConversion {
  amount_fc: number;        // foreign currency amount
  rate: number;             // FC -> base rate
  amount_base: number;      // base currency equivalent
}

/** Convert a foreign-currency amount to base currency at a given rate. */
export function convertToBase(amountFc: number, rate: number): FxConversion {
  const baseCents = Math.round(toCents(amountFc) * rate);
  return {
    amount_fc: amountFc,
    rate,
    amount_base: fromCents(baseCents),
  };
}

/** Realized FX gain/loss when settling a foreign-currency receivable/payable.
 *  positive => gain, negative => loss (from base perspective).
 */
export function realizedFxGainLoss(
  amountFc: number,
  rateAtTransaction: number,
  rateAtSettlement: number,
): number {
  const baseAtTxn = Math.round(toCents(amountFc) * rateAtTransaction);
  const baseAtSettle = Math.round(toCents(amountFc) * rateAtSettlement);
  return fromCents(baseAtSettle - baseAtTxn);
}

/** Unrealized FX gain/loss for a foreign-currency open balance at period-end. */
export function unrealizedFxGainLoss(
  balanceFc: number,
  historicalRate: number,
  closingRate: number,
): number {
  const baseHistorical = Math.round(toCents(balanceFc) * historicalRate);
  const baseClosing = Math.round(toCents(balanceFc) * closingRate);
  return fromCents(baseClosing - baseHistorical);
}

/** Average rate across an array of daily rates (for income statement translation). */
export function averageRate(rates: number[]): number {
  if (!rates.length) return 1;
  return rates.reduce((a, b) => a + b, 0) / rates.length;
}
