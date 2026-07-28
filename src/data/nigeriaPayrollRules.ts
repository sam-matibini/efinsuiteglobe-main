// Nigeria payroll statutory rules
// Effective 1 January 2026: Nigeria Tax Act 2025 (NTA 2025) — new PAYE bands
// (0%–25%), CRA abolished and replaced with Rent Relief.
// Legacy rules retained for pay periods dated before 2026-01-01 under
// PITA 2011 (as amended) + Finance Acts 2019/2020.
//
// Sources: Nigeria Tax Act 2025 (signed June 2025); Nigeria Revenue Service
// (NRS) guidelines; Pension Reform Act 2014; National Housing Fund Act.

export interface PayeBracket {
  bracketMin: number;      // annual NGN
  bracketMax: number | null;
  rate: number;            // percent
}

const NTA_2025_EFFECTIVE_FROM = '2026-01-01';

/**
 * NTA 2025 progressive PAYE bands (effective 1 Jan 2026) applied to
 * annual TAXABLE income (gross − pension − rent relief − NHF − NHIS − life).
 */
export function getNigeriaPayeBrackets(): PayeBracket[] {
  return [
    { bracketMin: 0,           bracketMax: 800_000,    rate: 0 },
    { bracketMin: 800_000,     bracketMax: 3_000_000,  rate: 15 },
    { bracketMin: 3_000_000,   bracketMax: 12_000_000, rate: 18 },
    { bracketMin: 12_000_000,  bracketMax: 25_000_000, rate: 21 },
    { bracketMin: 25_000_000,  bracketMax: 50_000_000, rate: 23 },
    { bracketMin: 50_000_000,  bracketMax: null,       rate: 25 },
  ];
}

/**
 * Legacy PITA 6th Schedule bands (used for pay periods before 2026-01-01).
 */
export function getLegacyPitaBrackets(): PayeBracket[] {
  return [
    { bracketMin: 0,          bracketMax: 300_000,   rate: 7 },
    { bracketMin: 300_000,    bracketMax: 600_000,   rate: 11 },
    { bracketMin: 600_000,    bracketMax: 1_100_000, rate: 15 },
    { bracketMin: 1_100_000,  bracketMax: 1_600_000, rate: 19 },
    { bracketMin: 1_600_000,  bracketMax: 3_200_000, rate: 21 },
    { bracketMin: 3_200_000,  bracketMax: null,      rate: 24 },
  ];
}

/**
 * @deprecated CRA abolished by NTA 2025 (effective 2026-01-01). Retained for
 * recomputing legacy periods only.
 */
export function calculateConsolidatedReliefAllowance(annualGross: number): number {
  const fixed = Math.max(200_000, annualGross * 0.01);
  const variable = annualGross * 0.20;
  return fixed + variable;
}

/**
 * NTA 2025 Rent Relief — 20% of annual rent paid, capped at ₦500,000.
 * Returns 0 when the employee pays no rent.
 */
export function calculateRentRelief(annualRent: number): number {
  const rent = Math.max(0, annualRent || 0);
  return Math.min(rent * 0.20, 500_000);
}

/**
 * Statutory pensionable base (PRA 2014 s.4):
 *   Basic salary + Housing allowance + Transport allowance.
 * When callers don't supply the split, we fall back to gross.
 */
export function getPensionableBase(basic: number, housing: number, transport: number, fallbackGross = 0): number {
  const explicit = (basic || 0) + (housing || 0) + (transport || 0);
  return explicit > 0 ? explicit : fallbackGross;
}

function isNta2025(payPeriodStart?: string): boolean {
  if (!payPeriodStart) return true; // default to current law
  return payPeriodStart >= NTA_2025_EFFECTIVE_FROM;
}

/**
 * Compute annual PAYE (naira) from annual gross + optional pay-component split.
 * Uses NTA 2025 rules by default; falls back to PITA (with CRA + 1% minimum
 * tax) for pay-period-start dates before 2026-01-01.
 */
export function calculateNigeriaAnnualPaye(input: {
  annualGross: number;
  annualBasic?: number;
  annualHousing?: number;
  annualTransport?: number;
  annualRent?: number;
  annualLifeAssurance?: number;
  payPeriodStart?: string; // ISO date
}): {
  taxableIncome: number;
  tax: number;
  pension: number;
  nhf: number;
  rentRelief: number;
  cra: number; // 0 under NTA 2025; populated only for legacy path
  regime: 'NTA_2025' | 'PITA_LEGACY';
} {
  const gross = Math.max(0, input.annualGross || 0);
  const pensionable = getPensionableBase(
    input.annualBasic || 0,
    input.annualHousing || 0,
    input.annualTransport || 0,
    gross,
  );
  const pension = pensionable * 0.08;
  const nhf = (input.annualBasic || pensionable) * 0.025;
  const life = input.annualLifeAssurance || 0;
  const useNta = isNta2025(input.payPeriodStart);

  let taxableIncome: number;
  let cra = 0;
  let rentRelief = 0;
  let brackets: PayeBracket[];

  if (useNta) {
    rentRelief = calculateRentRelief(input.annualRent || 0);
    taxableIncome = Math.max(0, gross - pension - rentRelief - nhf - life);
    brackets = getNigeriaPayeBrackets();
  } else {
    cra = calculateConsolidatedReliefAllowance(gross);
    taxableIncome = Math.max(0, gross - cra - pension - nhf - life);
    brackets = getLegacyPitaBrackets();
  }

  let tax = 0;
  let remaining = taxableIncome;
  for (const b of brackets) {
    if (remaining <= 0) break;
    const size = b.bracketMax ? b.bracketMax - b.bracketMin : remaining;
    const inBand = Math.min(remaining, size);
    tax += inBand * (b.rate / 100);
    remaining -= inBand;
  }

  // Legacy PITA 1% minimum-tax rule (repealed by NTA 2025).
  if (!useNta) {
    tax = Math.max(tax, gross * 0.01);
  }

  return {
    taxableIncome,
    tax,
    pension,
    nhf,
    rentRelief,
    cra,
    regime: useNta ? 'NTA_2025' : 'PITA_LEGACY',
  };
}
