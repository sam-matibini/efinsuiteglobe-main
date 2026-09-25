// Phase 15: Withholding Tax — Calculation Engine
import type { WhtComputation, WhtRegime, WhtVendorProfile } from './types';

export interface ComputeWhtInput {
  grossCents: number;
  regime: WhtRegime | null;
  vendorProfile: WhtVendorProfile | null;
  ytdPaidCents?: number;
}

/**
 * Resolution order:
 *   1) Vendor exempt → 0%
 *   2) Treaty rate (W-8BEN/NR301 with valid form) → treaty_rate
 *   3) Regime default rate
 * Threshold: only withhold once YTD paid (incl. this transaction) crosses threshold.
 */
export function computeWithholding(input: ComputeWhtInput): WhtComputation {
  const { grossCents, regime, vendorProfile, ytdPaidCents = 0 } = input;

  if (!regime) {
    return { grossCents, rate: 0, withheldCents: 0, netCents: grossCents, belowThreshold: false, exempt: true, reason: 'No regime' };
  }

  if (vendorProfile?.is_exempt) {
    return { grossCents, rate: 0, withheldCents: 0, netCents: grossCents, belowThreshold: false, exempt: true, reason: vendorProfile.exempt_reason || 'Vendor exempt' };
  }

  const newYtd = ytdPaidCents + grossCents;
  if (regime.threshold_cents > 0 && newYtd < regime.threshold_cents) {
    return { grossCents, rate: 0, withheldCents: 0, netCents: grossCents, belowThreshold: true, exempt: false, reason: `Below threshold (${regime.threshold_cents / 100})` };
  }

  let rate = regime.default_rate;
  let reason = `Regime default ${(rate * 100).toFixed(2)}%`;

  if (vendorProfile?.treaty_rate != null && vendorProfile.tax_form_type && vendorProfile.tax_form_type !== 'NONE') {
    const expiry = vendorProfile.tax_form_expiry_date ? new Date(vendorProfile.tax_form_expiry_date) : null;
    if (!expiry || expiry >= new Date()) {
      rate = vendorProfile.treaty_rate;
      reason = `Treaty rate ${(rate * 100).toFixed(2)}% (${vendorProfile.tax_form_type})`;
    }
  }

  const withheldCents = Math.round(grossCents * rate);
  return {
    grossCents,
    rate,
    withheldCents,
    netCents: grossCents - withheldCents,
    belowThreshold: false,
    exempt: false,
    reason,
  };
}

/** Aggregate per-vendor YTD totals into slip box amounts */
export function aggregateSlipBoxes(
  transactions: { gross_amount_cents: number; withheld_amount_cents: number }[],
  regime: WhtRegime,
): { boxAmounts: Record<string, number>; totalPaid: number; totalWithheld: number } {
  const totalPaid = transactions.reduce((s, t) => s + t.gross_amount_cents, 0);
  const totalWithheld = transactions.reduce((s, t) => s + t.withheld_amount_cents, 0);
  const boxKey = regime.box_code || 'box_1';
  const taxBoxKey = `${boxKey}_tax_withheld`;
  return {
    boxAmounts: { [boxKey]: totalPaid, [taxBoxKey]: totalWithheld },
    totalPaid,
    totalWithheld,
  };
}
