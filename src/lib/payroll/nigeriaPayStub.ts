// Nigerian pay slip calculation for pay runs.
//
// Law applied (pay periods from 1 Jan 2026):
//   PAYE     Nigeria Tax Act 2025: bands 0–25% on annual chargeable income;
//            reliefs: pension, NHF, NHIS, life assurance and rent relief
//            (20% of annual rent, max ₦500,000). CRA abolished. Pre-2026 periods use PITA.
//   Pension  Pension Reform Act 2014: employee 8% + employer 10% (minimums) of
//            basic + housing + transport.
//   NHF      National Housing Fund Act (as amended by the Business Facilitation Act 2022):
//            2.5% of basic, voluntary for private-sector employees (opt-in).
//   NSITF    Employees' Compensation Act 2010: employer-only 1% of total monthly payroll.
//
// The result reuses the generic pay-stub columns so remittances, slips and journals keep
// working:  cppContribution = pension (employee), cppEmployer = pension (employer),
//           eiPremium = NHF (employee), eiEmployer = NSITF (employer), federalTax = PAYE.
import { calculateNigeriaAnnualPaye } from '@/data/nigeriaPayrollRules';
import {
  calculateEarnings,
  getPayPeriodsPerYear,
  type EmployeePayInfo,
  type PayStubCalculation,
} from '@/lib/payrollCalculator';

export const NG_PENSION_EMPLOYEE_RATE = 0.08;
export const NG_PENSION_EMPLOYER_RATE = 0.10;
export const NG_NSITF_EMPLOYER_RATE = 0.01;

/** Optional Nigerian inputs, read from employees.statutory_profile. Amounts are annual naira. */
export interface NigeriaPayProfile {
  annualBasic?: number;
  annualHousing?: number;
  annualTransport?: number;
  annualRent?: number;
  lifeAssurancePremium?: number;
  /** NHF election (voluntary for private-sector staff). Default false. */
  nhfOptIn?: boolean;
  /** Employer may pay more than the 10% minimum (PRA 2014 s.4(1)). Percent, e.g. 10. */
  employerPensionRate?: number;
}

const num = (v: unknown): number | undefined => {
  if (v === null || v === undefined || v === '') return undefined;
  const n = Number(String(v).replace(/[₦,\s]/g, ''));
  return Number.isFinite(n) && n >= 0 ? n : undefined;
};
const bool = (v: unknown): boolean | undefined => {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    if (['yes', 'y', 'true', '1', 'opt-in', 'opted in'].includes(s)) return true;
    if (['no', 'n', 'false', '0', 'opt-out', 'opted out'].includes(s)) return false;
  }
  return undefined;
};

/** Reads the Nigerian payroll inputs from an employee's statutory_profile JSON. Unknown keys are ignored. */
export function nigeriaProfileFromStatutory(profile: unknown): NigeriaPayProfile {
  const p = (profile && typeof profile === 'object' ? profile : {}) as Record<string, unknown>;
  return {
    annualBasic: num(p.annual_basic),
    annualHousing: num(p.annual_housing),
    annualTransport: num(p.annual_transport),
    annualRent: num(p.annual_rent),
    lifeAssurancePremium: num(p.life_assurance_premium),
    nhfOptIn: bool(p.nhf_opt_in) ?? (typeof p.nhf_number === 'string' && p.nhf_number.trim() !== '' ? true : undefined),
    employerPensionRate: num(p.employer_pension_rate),
  };
}

/** True for 'NG', 'Nigeria' or an object carrying either as code/name. */
export function isNigeria(country: unknown): boolean {
  if (!country) return false;
  if (typeof country === 'string') return ['ng', 'nga', 'nigeria'].includes(country.trim().toLowerCase());
  if (typeof country === 'object') {
    const c = country as { code?: unknown; name?: unknown };
    return isNigeria(c.code) || isNigeria(c.name);
  }
  return false;
}

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Calculates one Nigerian pay slip. Regular pay is annualised for PAYE; bonus, commission and
 * other one-off earnings are taxed at the marginal rate (annual tax with them minus without),
 * and are excluded from the pension base.
 */
export function calculateNigeriaPayStub(
  info: EmployeePayInfo,
  profile: NigeriaPayProfile = {},
  payPeriodStart?: string,
): PayStubCalculation {
  const { regularEarnings, overtimeEarnings, vacationPay, grossPay } = calculateEarnings(info);
  const periods = getPayPeriodsPerYear(info.payFrequency);
  const oneOff = (info.bonus || 0) + (info.commission || 0) + (info.otherEarnings || 0);
  const recurring = Math.max(0, grossPay - oneOff);
  const annualRecurring = recurring * periods;

  // Pensionable base: basic + housing + transport when the split is known, else recurring pay.
  const hasSplit = !!(profile.annualBasic || profile.annualHousing || profile.annualTransport);
  const annualPensionable = hasSplit
    ? (profile.annualBasic || 0) + (profile.annualHousing || 0) + (profile.annualTransport || 0)
    : annualRecurring;
  const scale = hasSplit && annualRecurring > 0 ? Math.min(1, annualRecurring / annualPensionable) : 1;

  // Without a split, recurring pay stands in for basic so pension and NHF use the same base
  // whether or not one-off earnings are added.
  const engineInput = {
    annualBasic: hasSplit ? (profile.annualBasic || 0) * scale : annualRecurring,
    annualHousing: hasSplit ? (profile.annualHousing || 0) * scale : 0,
    annualTransport: hasSplit ? (profile.annualTransport || 0) * scale : 0,
    annualRent: profile.annualRent,
    annualLifeAssurance: profile.lifeAssurancePremium,
    payPeriodStart,
    nhfOptIn: profile.nhfOptIn ?? false,
  };
  const base = calculateNigeriaAnnualPaye({ ...engineInput, annualGross: annualRecurring });
  const withExtras = oneOff > 0
    ? calculateNigeriaAnnualPaye({ ...engineInput, annualGross: annualRecurring + oneOff })
    : base;

  const paye = base.tax / periods + (withExtras.tax - base.tax);
  const pensionEmployee = base.pension / periods;
  const employerRate = (profile.employerPensionRate ?? NG_PENSION_EMPLOYER_RATE * 100) / 100;
  const pensionEmployer = (pensionEmployee / NG_PENSION_EMPLOYEE_RATE) * Math.max(NG_PENSION_EMPLOYER_RATE, employerRate);
  const nhf = base.nhf / periods;
  const nsitf = grossPay * NG_NSITF_EMPLOYER_RATE;
  const additional = info.additionalTaxDeduction || 0;

  const totalDeductions = pensionEmployee + nhf + paye + additional;
  const totalEmployerCost = pensionEmployer + nsitf;

  return {
    regularEarnings: r2(regularEarnings),
    overtimeEarnings: r2(overtimeEarnings),
    vacationPay: r2(vacationPay),
    bonus: info.bonus,
    commission: info.commission,
    otherEarnings: info.otherEarnings,
    grossPay: r2(grossPay),

    cppContribution: r2(pensionEmployee),
    cpp2Contribution: 0,
    eiPremium: r2(nhf),
    federalTax: r2(paye),
    provincialTax: 0,
    additionalTax: additional,
    totalDeductions: r2(totalDeductions),

    netPay: r2(grossPay - totalDeductions),

    cppEmployer: r2(pensionEmployer),
    cpp2Employer: 0,
    eiEmployer: r2(nsitf),
    totalEmployerCost: r2(totalEmployerCost),

    ytdGross: r2(info.ytdGross + grossPay),
    ytdCpp: r2(info.ytdCpp + pensionEmployee),
    ytdEi: r2(info.ytdEi + nhf),
    ytdFederalTax: r2(info.ytdFederalTax + paye),
    ytdProvincialTax: r2(info.ytdProvincialTax),
  };
}
