// Nigeria payroll statutory rules — 2025 refresh
// Sources: Personal Income Tax Act (PITA) 2011 as amended by Finance Acts;
// Pension Reform Act 2014; National Housing Fund Act; Employee Compensation
// Act 2010 (NSITF); Industrial Training Fund (Amendment) Act 2011.

export interface PayeBracket {
  bracketMin: number;      // annual NGN
  bracketMax: number | null;
  rate: number;            // percent
}

/**
 * Progressive PAYE bands applied to annual TAXABLE income
 * (gross emoluments − Consolidated Relief Allowance − pension − NHF − life assurance).
 */
export function getNigeriaPayeBrackets(): PayeBracket[] {
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
 * Consolidated Relief Allowance (PITA s.33 as amended):
 *   CRA = higher of (₦200,000 or 1% of gross) + 20% of gross emoluments.
 */
export function calculateConsolidatedReliefAllowance(annualGross: number): number {
  const fixed = Math.max(200_000, annualGross * 0.01);
  const variable = annualGross * 0.20;
  return fixed + variable;
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

/**
 * PITA minimum-tax rule (s.37): where taxable income after reliefs is nil
 * or would yield tax below 1% of gross, the employee pays 1% of gross.
 */
export function applyMinimumTax(computedTax: number, annualGross: number): number {
  const minTax = annualGross * 0.01;
  return Math.max(computedTax, minTax);
}

/**
 * Compute annual PAYE (naira) from annual gross + optional pay-component split.
 */
export function calculateNigeriaAnnualPaye(input: {
  annualGross: number;
  annualBasic?: number;
  annualHousing?: number;
  annualTransport?: number;
  annualLifeAssurance?: number;
}): { taxableIncome: number; tax: number; cra: number; pension: number; nhf: number } {
  const gross = Math.max(0, input.annualGross || 0);
  const pensionable = getPensionableBase(
    input.annualBasic || 0,
    input.annualHousing || 0,
    input.annualTransport || 0,
    gross,
  );
  const pension = pensionable * 0.08;
  const nhf = (input.annualBasic || pensionable) * 0.025;
  const cra = calculateConsolidatedReliefAllowance(gross);
  const life = input.annualLifeAssurance || 0;

  const taxableIncome = Math.max(0, gross - cra - pension - nhf - life);

  let tax = 0;
  let remaining = taxableIncome;
  for (const b of getNigeriaPayeBrackets()) {
    if (remaining <= 0) break;
    const size = b.bracketMax ? b.bracketMax - b.bracketMin : remaining;
    const inBand = Math.min(remaining, size);
    tax += inBand * (b.rate / 100);
    remaining -= inBand;
  }

  tax = applyMinimumTax(tax, gross);
  return { taxableIncome, tax, cra, pension, nhf };
}
