// Canadian Payroll Tax Calculator
// Implements CRA payroll deduction formulas for 2025

import {
  CPP_RATES,
  EI_RATES,
  FEDERAL_TAX_BRACKETS,
  FEDERAL_BASIC_PERSONAL_AMOUNT,
  FEDERAL_CANADA_EMPLOYMENT_AMOUNT,
  PROVINCIAL_TAX_DATA,
  TD1_DEFAULTS,
  calculateFederalTax,
  calculateProvincialTax,
  calculateCPP,
  calculateEI,
} from '@/data/canadianTaxData';

export type PayFrequency = 'weekly' | 'bi_weekly' | 'semi_monthly' | 'monthly';

export interface EmployeePayInfo {
  employeeId: string;
  province: string;
  payFrequency: PayFrequency;
  annualSalary?: number;
  hourlyRate?: number;
  regularHours: number;
  overtimeHours: number;
  vacationHours: number;
  sickHours: number;
  bonus: number;
  commission: number;
  otherEarnings: number;
  td1FederalClaim: number;
  td1ProvincialClaim: number;
  additionalTaxDeduction: number;
  ytdGross: number;
  ytdCpp: number;
  ytdEi: number;
  ytdFederalTax: number;
  ytdProvincialTax: number;
  cppExempt?: boolean;
  eiExempt?: boolean;
}

export interface PayStubCalculation {
  // Earnings
  regularEarnings: number;
  overtimeEarnings: number;
  vacationPay: number;
  bonus: number;
  commission: number;
  otherEarnings: number;
  grossPay: number;
  
  // Deductions
  cppContribution: number;
  cpp2Contribution: number;
  eiPremium: number;
  federalTax: number;
  provincialTax: number;
  additionalTax: number;
  totalDeductions: number;
  
  // Net Pay
  netPay: number;
  
  // Employer Contributions
  cppEmployer: number;
  cpp2Employer: number;
  eiEmployer: number;
  totalEmployerCost: number;
  
  // YTD Totals (updated)
  ytdGross: number;
  ytdCpp: number;
  ytdEi: number;
  ytdFederalTax: number;
  ytdProvincialTax: number;
}

// Get number of pay periods per year
function getPayPeriodsPerYear(frequency: PayFrequency): number {
  switch (frequency) {
    case 'weekly': return 52;
    case 'bi_weekly': return 26;
    case 'semi_monthly': return 24;
    case 'monthly': return 12;
    default: return 26;
  }
}

// Calculate earnings for pay period
function calculateEarnings(info: EmployeePayInfo): {
  regularEarnings: number;
  overtimeEarnings: number;
  vacationPay: number;
  grossPay: number;
} {
  let regularEarnings = 0;
  let overtimeEarnings = 0;
  
  if (info.annualSalary && info.annualSalary > 0) {
    // Salaried employee
    const periodsPerYear = getPayPeriodsPerYear(info.payFrequency);
    regularEarnings = info.annualSalary / periodsPerYear;
    // For salaried, overtime might be calculated differently or not at all
    if (info.hourlyRate && info.overtimeHours > 0) {
      overtimeEarnings = info.overtimeHours * info.hourlyRate * 1.5;
    }
  } else if (info.hourlyRate && info.hourlyRate > 0) {
    // Hourly employee
    regularEarnings = info.regularHours * info.hourlyRate;
    overtimeEarnings = info.overtimeHours * info.hourlyRate * 1.5;
  }
  
  // Vacation pay (4% minimum in most provinces, or paid at hourly rate if taking time)
  let vacationPay = 0;
  if (info.vacationHours > 0 && info.hourlyRate) {
    vacationPay = info.vacationHours * info.hourlyRate;
  }
  
  const grossPay = regularEarnings + overtimeEarnings + vacationPay + 
                   info.bonus + info.commission + info.otherEarnings;
  
  return { regularEarnings, overtimeEarnings, vacationPay, grossPay };
}

// Calculate annualized income for tax purposes
function calculateAnnualizedIncome(
  grossPay: number, 
  payFrequency: PayFrequency,
  bonus: number = 0,
  commission: number = 0
): number {
  const periodsPerYear = getPayPeriodsPerYear(payFrequency);
  // Regular pay is annualized, bonuses are treated separately
  const regularPay = grossPay - bonus - commission;
  return (regularPay * periodsPerYear) + bonus + commission;
}

// Calculate per-period tax from annual tax
function calculatePeriodTax(annualTax: number, payFrequency: PayFrequency): number {
  const periodsPerYear = getPayPeriodsPerYear(payFrequency);
  return annualTax / periodsPerYear;
}

// Main calculation function
export function calculatePayStub(info: EmployeePayInfo): PayStubCalculation {
  // Step 1: Calculate earnings
  const { regularEarnings, overtimeEarnings, vacationPay, grossPay } = calculateEarnings(info);
  
  // Step 2: Calculate CPP (skip if exempt)
  // Pass pay frequency so CPP basic exemption is divided by the correct number of periods
  const pensionableEarnings = grossPay;
  const periodsPerYear = getPayPeriodsPerYear(info.payFrequency);
  const cpp = info.cppExempt
    ? { employeeContribution: 0, employerContribution: 0, cpp2Employee: 0, cpp2Employer: 0 }
    : calculateCPP(pensionableEarnings, info.ytdGross, periodsPerYear);
  
  // Step 3: Calculate EI (skip if exempt)
  const insurableEarnings = grossPay;
  const ei = info.eiExempt
    ? { employeePremium: 0, employerPremium: 0 }
    : calculateEI(insurableEarnings, info.ytdGross);
  
  // Step 4: Calculate income taxes using CRA formula
  const annualizedGross = calculateAnnualizedIncome(
    grossPay, 
    info.payFrequency, 
    info.bonus, 
    info.commission
  );
  
  // CRA T4032 Formula: Non-refundable credit method
  // C = Annual CPP contribution (period × periods per year)
  const annualCpp = cpp.employeeContribution * periodsPerYear;
  
  // E = Annual EI premium
  const annualEi = ei.employeePremium * periodsPerYear;
  
  // Federal tax: T3 = bracket tax on annualized gross, then subtract credits at 15%
  const annualFederalBracketTax = calculateFederalTax(annualizedGross);
  const LOWEST_FEDERAL_RATE = 0.15;
  const K  = info.td1FederalClaim * LOWEST_FEDERAL_RATE;        // BPA + other TD1 credits
  const K2 = annualCpp * LOWEST_FEDERAL_RATE;                    // CPP non-refundable credit
  const K3 = annualEi * LOWEST_FEDERAL_RATE;                     // EI non-refundable credit
  const K4 = FEDERAL_CANADA_EMPLOYMENT_AMOUNT * LOWEST_FEDERAL_RATE; // CEA credit ($1,368 × 15%)
  const annualFederalTax = Math.max(0, annualFederalBracketTax - K - K2 - K3 - K4);
  const federalTax = calculatePeriodTax(annualFederalTax, info.payFrequency);
  
  // Provincial tax: bracket tax on annualized gross, subtract credits at lowest provincial rate
  const provinceData = PROVINCIAL_TAX_DATA[info.province];
  const lowestProvincialRate = provinceData?.brackets?.[0]?.rate || 0.10;
  const annualProvincialBracketTax = calculateProvincialTax(annualizedGross, info.province);
  const S  = info.td1ProvincialClaim * lowestProvincialRate;     // Provincial TD1 credits
  const S2 = annualCpp * lowestProvincialRate;                    // CPP provincial credit
  const S3 = annualEi * lowestProvincialRate;                     // EI provincial credit
  const annualProvincialTax = Math.max(0, annualProvincialBracketTax - S - S2 - S3);
  const provincialTax = calculatePeriodTax(annualProvincialTax, info.payFrequency);
  
  // Step 5: Calculate total deductions
  const totalDeductions = 
    cpp.employeeContribution + 
    cpp.cpp2Employee +
    ei.employeePremium + 
    federalTax + 
    provincialTax + 
    info.additionalTaxDeduction;
  
  // Step 6: Calculate net pay
  const netPay = grossPay - totalDeductions;
  
  // Step 7: Calculate employer costs
  const totalEmployerCost = 
    cpp.employerContribution + 
    cpp.cpp2Employer +
    ei.employerPremium;
  
  // Step 8: Update YTD totals
  const newYtdGross = info.ytdGross + grossPay;
  const newYtdCpp = info.ytdCpp + cpp.employeeContribution + cpp.cpp2Employee;
  const newYtdEi = info.ytdEi + ei.employeePremium;
  const newYtdFederalTax = info.ytdFederalTax + federalTax;
  const newYtdProvincialTax = info.ytdProvincialTax + provincialTax;
  
  return {
    // Earnings
    regularEarnings: Math.round(regularEarnings * 100) / 100,
    overtimeEarnings: Math.round(overtimeEarnings * 100) / 100,
    vacationPay: Math.round(vacationPay * 100) / 100,
    bonus: info.bonus,
    commission: info.commission,
    otherEarnings: info.otherEarnings,
    grossPay: Math.round(grossPay * 100) / 100,
    
    // Deductions
    cppContribution: Math.round(cpp.employeeContribution * 100) / 100,
    cpp2Contribution: Math.round(cpp.cpp2Employee * 100) / 100,
    eiPremium: Math.round(ei.employeePremium * 100) / 100,
    federalTax: Math.round(federalTax * 100) / 100,
    provincialTax: Math.round(provincialTax * 100) / 100,
    additionalTax: info.additionalTaxDeduction,
    totalDeductions: Math.round(totalDeductions * 100) / 100,
    
    // Net Pay
    netPay: Math.round(netPay * 100) / 100,
    
    // Employer Contributions
    cppEmployer: Math.round(cpp.employerContribution * 100) / 100,
    cpp2Employer: Math.round(cpp.cpp2Employer * 100) / 100,
    eiEmployer: Math.round(ei.employerPremium * 100) / 100,
    totalEmployerCost: Math.round(totalEmployerCost * 100) / 100,
    
    // YTD Totals
    ytdGross: Math.round(newYtdGross * 100) / 100,
    ytdCpp: Math.round(newYtdCpp * 100) / 100,
    ytdEi: Math.round(newYtdEi * 100) / 100,
    ytdFederalTax: Math.round(newYtdFederalTax * 100) / 100,
    ytdProvincialTax: Math.round(newYtdProvincialTax * 100) / 100,
  };
}

// Get default TD1 claims for an employee
export function getDefaultTD1Claims(province: string): {
  federalClaim: number;
  provincialClaim: number;
} {
  const federalData = TD1_DEFAULTS['federal'];
  const provincialData = TD1_DEFAULTS[province] || TD1_DEFAULTS['ON'];
  
  return {
    federalClaim: federalData.basicPersonalAmount + federalData.canadaEmploymentAmount,
    provincialClaim: provincialData.basicPersonalAmount + (provincialData.canadaEmploymentAmount || 0),
  };
}

// Calculate pay run totals from multiple employees
export function calculatePayRunTotals(payStubs: PayStubCalculation[]): {
  totalGross: number;
  totalDeductions: number;
  totalNet: number;
  totalEmployerContributions: number;
  employeeCount: number;
} {
  return {
    totalGross: payStubs.reduce((sum, p) => sum + p.grossPay, 0),
    totalDeductions: payStubs.reduce((sum, p) => sum + p.totalDeductions, 0),
    totalNet: payStubs.reduce((sum, p) => sum + p.netPay, 0),
    totalEmployerContributions: payStubs.reduce((sum, p) => sum + p.totalEmployerCost, 0),
    employeeCount: payStubs.length,
  };
}
