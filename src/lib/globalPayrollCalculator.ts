// Global Payroll Calculation Engine for EFINSUITE Globe
// Extends the existing Canadian payroll calculator with multi-country support

import type { PayrollCalculation } from '@/types/global';

interface DeductionRule {
  id: string;
  code: string;
  name: string;
  calculationMethod: 'percentage' | 'tiered' | 'flat' | 'formula';
  isEmployerContribution: boolean;
  isEmployeeDeduction: boolean;
  maxPensionableEarnings: number | null;
  exemptionAmount: number | null;
  maxAnnualAmount: number | null;
  brackets: Array<{
    bracketMin: number;
    bracketMax: number | null;
    rate: number;
    employerRate: number | null;
  }>;
}

interface GlobalPayrollInput {
  grossPay: number;
  payPeriod: 'weekly' | 'bi-weekly' | 'semi-monthly' | 'monthly' | 'annual';
  yearToDateGross?: number;
  yearToDateDeductions?: Record<string, number>;
  deductionRules: DeductionRule[];
  countryCode: string;
}

const PAY_PERIODS_PER_YEAR: Record<string, number> = {
  weekly: 52,
  'bi-weekly': 26,
  'semi-monthly': 24,
  monthly: 12,
  annual: 1,
};

/**
 * Calculate global payroll deductions for an employee
 */
export function calculateGlobalPayroll(input: GlobalPayrollInput): PayrollCalculation {
  const { 
    grossPay, 
    payPeriod, 
    yearToDateGross = 0, 
    yearToDateDeductions = {},
    deductionRules,
  } = input;
  
  const periodsPerYear = PAY_PERIODS_PER_YEAR[payPeriod] || 26;
  const annualizedGross = grossPay * periodsPerYear;
  
  const employeeDeductions: PayrollCalculation['employeeDeductions'] = [];
  const employerContributions: PayrollCalculation['employerContributions'] = [];
  
  for (const rule of deductionRules) {
    const calculation = calculateDeduction(rule, {
      grossPay,
      annualizedGross,
      yearToDateGross,
      yearToDateDeduction: yearToDateDeductions[rule.code] || 0,
      periodsPerYear,
    });
    
    if (rule.isEmployeeDeduction && calculation.employeeAmount > 0) {
      employeeDeductions.push({
        deductionTypeId: rule.id,
        code: rule.code,
        name: rule.name,
        amount: calculation.employeeAmount,
      });
    }
    
    if (rule.isEmployerContribution && calculation.employerAmount > 0) {
      employerContributions.push({
        deductionTypeId: rule.id,
        code: rule.code,
        name: rule.name,
        amount: calculation.employerAmount,
      });
    }
  }
  
  const totalEmployeeDeductions = employeeDeductions.reduce((sum, d) => sum + d.amount, 0);
  const totalEmployerContributions = employerContributions.reduce((sum, d) => sum + d.amount, 0);
  
  return {
    grossPay,
    employeeDeductions,
    employerContributions,
    totalEmployeeDeductions: roundCurrency(totalEmployeeDeductions),
    totalEmployerContributions: roundCurrency(totalEmployerContributions),
    netPay: roundCurrency(grossPay - totalEmployeeDeductions),
  };
}

interface DeductionContext {
  grossPay: number;
  annualizedGross: number;
  yearToDateGross: number;
  yearToDateDeduction: number;
  periodsPerYear: number;
}

function calculateDeduction(
  rule: DeductionRule,
  context: DeductionContext
): { employeeAmount: number; employerAmount: number } {
  const { grossPay, annualizedGross, yearToDateGross, yearToDateDeduction, periodsPerYear } = context;
  
  let employeeAmount = 0;
  let employerAmount = 0;
  
  // Calculate pensionable/insurable earnings
  let pensionableEarnings = grossPay;
  
  // Apply exemption if applicable (e.g., CPP basic exemption)
  if (rule.exemptionAmount) {
    const perPeriodExemption = rule.exemptionAmount / periodsPerYear;
    pensionableEarnings = Math.max(0, grossPay - perPeriodExemption);
  }
  
  // Apply maximum pensionable earnings cap
  if (rule.maxPensionableEarnings) {
    const maxPensionable = rule.maxPensionableEarnings;
    const remainingRoom = Math.max(0, maxPensionable - yearToDateGross);
    pensionableEarnings = Math.min(pensionableEarnings, remainingRoom);
  }
  
  switch (rule.calculationMethod) {
    case 'percentage':
      if (rule.brackets.length > 0) {
        const bracket = rule.brackets[0];
        if (rule.isEmployeeDeduction) {
          employeeAmount = pensionableEarnings * (bracket.rate / 100);
        }
        if (rule.isEmployerContribution) {
          employerAmount = pensionableEarnings * ((bracket.employerRate || bracket.rate) / 100);
        }
      }
      break;
      
    case 'tiered':
      const annualTax = calculateTieredAmount(annualizedGross, rule.brackets);
      const perPeriodTax = annualTax / periodsPerYear;
      
      if (rule.isEmployeeDeduction) {
        employeeAmount = perPeriodTax;
      }
      break;
      
    case 'flat':
      if (rule.brackets.length > 0) {
        const bracket = rule.brackets.find(b => 
          annualizedGross >= b.bracketMin && 
          (b.bracketMax === null || annualizedGross <= b.bracketMax)
        );
        if (bracket) {
          employeeAmount = bracket.rate / periodsPerYear;
        }
      }
      break;
  }
  
  // Apply annual maximum
  if (rule.maxAnnualAmount) {
    const remainingRoom = Math.max(0, rule.maxAnnualAmount - yearToDateDeduction);
    employeeAmount = Math.min(employeeAmount, remainingRoom);
    employerAmount = Math.min(employerAmount, remainingRoom);
  }
  
  return {
    employeeAmount: roundCurrency(employeeAmount),
    employerAmount: roundCurrency(employerAmount),
  };
}

/**
 * Calculate tiered/progressive tax
 */
function calculateTieredAmount(
  annualAmount: number,
  brackets: DeductionRule['brackets']
): number {
  let totalTax = 0;
  let remainingAmount = annualAmount;
  
  const sortedBrackets = [...brackets].sort((a, b) => a.bracketMin - b.bracketMin);
  
  for (const bracket of sortedBrackets) {
    if (remainingAmount <= 0) break;
    
    const bracketSize = bracket.bracketMax 
      ? bracket.bracketMax - bracket.bracketMin 
      : remainingAmount;
    
    const taxableInBracket = Math.min(remainingAmount, bracketSize);
    totalTax += taxableInBracket * (bracket.rate / 100);
    remainingAmount -= taxableInBracket;
  }
  
  return totalTax;
}

/**
 * Round to 2 decimal places
 */
function roundCurrency(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

/**
 * Get statutory deductions by country
 */
export function getStatutoryDeductionCodes(countryCode: string): string[] {
  switch (countryCode) {
    case 'CA':
      return ['CPP', 'CPP2', 'EI', 'FIT', 'PIT'];
    case 'US':
      return ['FICA-SS', 'FICA-MED', 'FWT', 'SWT'];
    case 'ZM':
      return ['PAYE', 'NAPSA', 'NHIMA'];
    case 'KE':
      return ['PAYE', 'NHIF', 'NSSF-T1', 'NSSF-T2', 'HOUSING-LEVY', 'SHIF'];
    case 'BI':
      return ['IPR', 'INSS-EMP', 'INSS-ER', 'MUTUELLE'];
    default:
      return [];
  }
}

/**
 * Format payroll summary for display
 */
export function formatGlobalPayrollSummary(
  calculation: PayrollCalculation,
  currencyCode: string = 'CAD'
): string {
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode,
  });
  
  const lines = [
    `Gross Pay: ${formatter.format(calculation.grossPay)}`,
    `Deductions: ${formatter.format(calculation.totalEmployeeDeductions)}`,
    `Net Pay: ${formatter.format(calculation.netPay)}`,
  ];
  
  if (calculation.totalEmployerContributions > 0) {
    lines.push(`Employer Cost: ${formatter.format(calculation.totalEmployerContributions)}`);
  }
  
  return lines.join('\n');
}
