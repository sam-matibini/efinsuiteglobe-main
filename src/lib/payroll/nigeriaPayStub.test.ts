import { describe, expect, it } from 'vitest';
import type { EmployeePayInfo } from '@/lib/payrollCalculator';
import { calculateNigeriaPayStub, isNigeria, nigeriaProfileFromStatutory } from './nigeriaPayStub';

const info = (over: Partial<EmployeePayInfo> = {}): EmployeePayInfo => ({
  employeeId: 'e1', province: 'LA', payFrequency: 'monthly', annualSalary: 6_000_000,
  regularHours: 0, overtimeHours: 0, vacationHours: 0, sickHours: 0, bonus: 0, commission: 0, otherEarnings: 0,
  td1FederalClaim: 0, td1ProvincialClaim: 0, additionalTaxDeduction: 0,
  ytdGross: 0, ytdCpp: 0, ytdEi: 0, ytdFederalTax: 0, ytdProvincialTax: 0, ...over,
});

describe('Nigerian pay slip (NTA 2025)', () => {
  it('₦500,000/month: 8% pension relief, PAYE on 0/15/18% bands, no Canadian deductions', () => {
    // Annual 6,000,000 − pension 480,000 = 5,520,000 taxable
    // Tax = 2,200,000×15% + 2,520,000×18% = 330,000 + 453,600 = 783,600 → 65,300/month
    const s = calculateNigeriaPayStub(info(), {}, '2026-03-01');
    expect(s.grossPay).toBe(500_000);
    expect(s.federalTax).toBe(65_300);          // PAYE
    expect(s.provincialTax).toBe(0);
    expect(s.cppContribution).toBe(40_000);     // pension employee 8%
    expect(s.cppEmployer).toBe(50_000);         // pension employer 10%
    expect(s.eiPremium).toBe(0);                // NHF off by default (voluntary)
    expect(s.eiEmployer).toBe(5_000);           // NSITF 1% employer
    expect(s.cpp2Contribution).toBe(0);
    expect(s.netPay).toBe(394_700);
    expect(s.totalEmployerCost).toBe(55_000);
  });

  it('applies rent relief (20% of rent, max ₦500,000)', () => {
    // relief 240,000 → taxable 5,280,000 → 330,000 + 2,280,000×18% = 740,400 → 61,700/month
    expect(calculateNigeriaPayStub(info(), { annualRent: 1_200_000 }, '2026-03-01').federalTax).toBe(61_700);
    // relief capped at 500,000 → taxable 5,020,000 → 330,000 + 363,600 = 693,600 → 57,800/month
    expect(calculateNigeriaPayStub(info(), { annualRent: 10_000_000 }, '2026-03-01').federalTax).toBe(57_800);
  });

  it('uses basic + housing + transport for pension and 2.5% of basic for opted-in NHF', () => {
    // pension 8% × 5,100,000 = 408,000; NHF 2.5% × 3,000,000 = 75,000
    // taxable 6,000,000 − 408,000 − 75,000 = 5,517,000 → 330,000 + 453,060 = 783,060 → 65,255/month
    const s = calculateNigeriaPayStub(info(), { annualBasic: 3_000_000, annualHousing: 1_500_000, annualTransport: 600_000, nhfOptIn: true }, '2026-03-01');
    expect(s.cppContribution).toBe(34_000);
    expect(s.cppEmployer).toBe(42_500);
    expect(s.eiPremium).toBe(6_250);
    expect(s.federalTax).toBe(65_255);
  });

  it('taxes a bonus at the marginal rate and keeps it out of the pension base', () => {
    const s = calculateNigeriaPayStub(info({ bonus: 200_000 }), {}, '2026-03-01');
    expect(s.grossPay).toBe(700_000);
    expect(s.cppContribution).toBe(40_000);
    expect(s.federalTax).toBe(101_300);          // 65,300 + 18% × 200,000
    expect(s.eiEmployer).toBe(7_000);            // NSITF on total pay
  });

  it('a minimum-wage earner pays no PAYE', () => {
    expect(calculateNigeriaPayStub(info({ annualSalary: 840_000 }), {}, '2026-03-01').federalTax).toBe(0);
  });

  it('honours a higher employer pension rate', () => {
    expect(calculateNigeriaPayStub(info(), { employerPensionRate: 12 }, '2026-03-01').cppEmployer).toBe(60_000);
  });

  it('uses the old PITA rules for periods before 2026', () => {
    const old = calculateNigeriaPayStub(info(), {}, '2025-12-01');
    expect(old.federalTax).not.toBe(65_300);
    expect(old.federalTax).toBeGreaterThan(0);
  });

  it('updates YTD totals', () => {
    const s = calculateNigeriaPayStub(info({ ytdGross: 1_000_000, ytdCpp: 80_000, ytdFederalTax: 130_600 }), {}, '2026-03-01');
    expect(s.ytdGross).toBe(1_500_000);
    expect(s.ytdCpp).toBe(120_000);
    expect(s.ytdFederalTax).toBe(195_900);
  });
});

describe('statutory profile and country helpers', () => {
  it('reads Nigerian inputs from statutory_profile', () => {
    expect(nigeriaProfileFromStatutory({ annual_rent: '₦1,200,000', nhf_opt_in: 'Yes', annual_basic: 3000000, rsa_number: 'PEN123' }))
      .toEqual({ annualBasic: 3_000_000, annualHousing: undefined, annualTransport: undefined, annualRent: 1_200_000, lifeAssurancePremium: undefined, nhfOptIn: true, employerPensionRate: undefined });
    expect(nigeriaProfileFromStatutory({ nhf_number: 'NHF-001' }).nhfOptIn).toBe(true);
    expect(nigeriaProfileFromStatutory(null)).toEqual(expect.objectContaining({ nhfOptIn: undefined }));
  });
  it('recognises Nigeria by code or name', () => {
    expect(isNigeria('NG')).toBe(true);
    expect(isNigeria('Nigeria')).toBe(true);
    expect(isNigeria({ code: 'NG', name: 'Nigeria' })).toBe(true);
    expect(isNigeria('CA')).toBe(false);
    expect(isNigeria(null)).toBe(false);
  });
});
